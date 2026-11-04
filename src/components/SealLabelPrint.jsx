import { useEffect, useMemo, useRef } from 'react'
import JsBarcode from 'jsbarcode'

const INK = '#000000'
const GREY = '#4B5563'
const LOGO_SRC = '/iposb-logo.png'

function pick(row, ...keys) {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function tierTitle(tier) {
  const t = String(tier || '').toLowerCase()
  if (t === 'baby') return 'BABY SEAL'
  if (t === 'mother') return 'MOTHER SEAL'
  if (t === 'father') return 'FATHER SEAL'
  return 'SEAL'
}

function looksLikeSealCode(raw) {
  const key = String(raw || '').trim().toUpperCase()
  if (!key) return false
  if (key.startsWith('BS-') || key.startsWith('MS-') || key.startsWith('FS-') || key.startsWith('SL-')) {
    return true
  }
  // Dest-prefixed: AREA-XXXXXX (hyphen + trailing alnum seq)
  return /^[A-Z0-9][A-Z0-9\-]*-[A-Z0-9]{4,}$/.test(key)
}

/** Collect CN codes from seal + optional pack session payload. */
export function sealContentCns(seal, pack = null) {
  const out = []
  const push = (raw) => {
    const v = String(raw || '').trim().toUpperCase()
    if (v && !out.includes(v)) out.push(v)
  }

  if (Array.isArray(seal?.leafConsignments)) {
    seal.leafConsignments.forEach(push)
  }

  const members = Array.isArray(seal?.members) ? seal.members : []
  for (const m of members) {
    const typ = String(m.memberType || m.member_type || '').toLowerCase()
    if (typ === 'cn') push(m.memberKey || m.member_key)
  }

  if (pack) {
    for (const item of pack.expected || []) {
      if (item?.scanned || item?.memberType === 'cn' || item?.member_type === 'cn') {
        push(item.memberKey || item.member_key || item.label)
      }
    }
    for (const item of pack.extras || []) {
      const typ = String(item.memberType || item.member_type || '').toLowerCase()
      if (typ === 'cn' || !typ) push(item.memberKey || item.member_key || item.label)
    }
  }

  return out
}

export function sealChildSealCodes(seal, pack = null) {
  const out = []
  const push = (raw) => {
    const v = String(raw || '').trim().toUpperCase()
    if (v && !out.includes(v)) out.push(v)
  }
  for (const m of seal?.members || []) {
    const typ = String(m.memberType || m.member_type || '').toLowerCase()
    if (typ === 'seal') push(m.memberKey || m.member_key)
  }
  if (pack) {
    for (const item of [...(pack.expected || []), ...(pack.extras || [])]) {
      const typ = String(item.memberType || item.member_type || '').toLowerCase()
      const key = String(item.memberKey || item.member_key || item.label || '').toUpperCase()
      if (typ === 'seal' || looksLikeSealCode(key)) {
        if (typ === 'seal' || (typ !== 'cn' && looksLikeSealCode(key))) {
          push(key)
        }
      }
    }
  }
  return out
}

/**
 * Merge seal + pack into one label source so barcode always has data.
 */
export function buildSealLabelSource(seal, pack = null) {
  if (!seal && !pack?.seal) return null
  const base = { ...(pack?.seal || {}), ...(seal || {}) }
  const contents = sealContentCns(base, pack)
  const childSeals = sealChildSealCodes(base, pack)
  return {
    ...base,
    leafConsignments: contents,
    cnCount: Number(base.cnCount ?? base.cn_count ?? contents.length) || contents.length,
    memberCount: Number(base.memberCount ?? base.member_count ?? 0)
      || contents.length + childSeals.length,
    _childSeals: childSeals,
  }
}

/**
 * Split seal code into dest prefix + random sequence for display.
 * e.g. KK-METRO-A-7K2M9Q → { prefix: 'KK-METRO-A', seq: '7K2M9Q' }
 */
export function splitSealCode(sealNo) {
  const code = String(sealNo || '').trim().toUpperCase()
  const i = code.lastIndexOf('-')
  if (i <= 0 || i >= code.length - 1) {
    return { prefix: code, seq: '' }
  }
  return { prefix: code.slice(0, i), seq: code.slice(i + 1) }
}

/**
 * Normalize seal → label fields.
 * Barcode value is always sealNo ({DEST}-{seq} or legacy BS-/MS-/FS-).
 * Dest is already encoded in the seal code — no separate "handover to" band.
 */
export function normalizeSealLabel(seal, lookups = {}, pack = null) {
  const source = buildSealLabelSource(seal, pack) || seal || {}
  const sealNo = pick(source, 'sealNo', 'seal_no').toUpperCase()
  const tier = pick(source, 'tier').toLowerCase()
  const destArea = pick(source, 'destAreaCode', 'dest_area_code').toUpperCase()
  const destDp = pick(source, 'destDeliveryPoint', 'dest_delivery_point').toUpperCase()
  const destHub = pick(source, 'destHubCode', 'dest_hub_code').toUpperCase()
  const originDp = pick(source, 'originDeliveryPoint', 'origin_delivery_point').toUpperCase()
  const originHub = pick(source, 'originHubCode', 'origin_hub_code').toUpperCase()
  const parts = splitSealCode(sealNo)
  const contents = Array.isArray(source.leafConsignments)
    ? source.leafConsignments
    : sealContentCns(source, pack)
  const childSeals = Array.isArray(source._childSeals)
    ? source._childSeals
    : sealChildSealCodes(source, pack)

  return {
    sealNo,
    codePrefix: parts.prefix,
    codeSeq: parts.seq,
    tier,
    tierTitle: tierTitle(tier),
    lifecycle: pick(source, 'lifecycle') || '',
    destArea: destArea || '',
    destDp: destDp || '',
    destHub: destHub || '',
    origin: originDp || originHub || '',
    contents,
    childSeals,
    cnCount: Number(source.cnCount ?? contents.length) || contents.length,
    memberCount: Number(source.memberCount ?? 0) || contents.length + childSeals.length,
  }
}

/** Synchronous barcode SVG markup for print HTML (no React needed). */
export function barcodeSvgHtml(value, height = 56) {
  const code = String(value || '').trim().toUpperCase()
  if (!code || typeof document === 'undefined') return ''
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(svg, code, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height,
      width: 1.8,
      background: '#ffffff',
      lineColor: INK,
    })
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', String(height))
    svg.style.display = 'block'
    svg.style.width = '100%'
    svg.style.height = `${height}px`
    return svg.outerHTML
  } catch {
    return ''
  }
}

function BarcodeSvg({ value, height = 56 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height,
        width: 1.8,
        background: 'transparent',
        lineColor: INK,
      })
    } catch {
      /* invalid characters — leave blank */
    }
  }, [value, height])
  return (
    <svg
      ref={ref}
      preserveAspectRatio="none"
      style={{ width: '100%', maxWidth: 320, height, display: 'block', margin: '0 auto' }}
    />
  )
}

/** One face: logo + tier, large barcode, dest-prefix seal code (no CN list / no handover band). */
function SealLabelFace({ label, barcodeEl }) {
  const line = `1.5px solid ${INK}`
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

  return (
    <div
      style={{
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        border: `2px solid ${INK}`,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        color: INK,
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', borderBottom: line }}>
        <div style={{ padding: '8px 10px', borderRight: line, display: 'flex', alignItems: 'center' }}>
          <img src={LOGO_SRC} alt="IPOSB" style={{ maxHeight: 30, maxWidth: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6 }}>{label.tierTitle}</div>
          {label.cnCount > 0 ? (
            <div style={{ fontSize: 9, color: GREY, marginTop: 2 }}>{label.cnCount} CN in bag</div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          flex: '1 1 auto',
          padding: '14px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1.2, color: GREY }}>
          SCAN SEAL
        </div>
        <div style={{ width: '100%' }}>{barcodeEl}</div>
        <div
          style={{
            fontFamily: mono,
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: 1,
            wordBreak: 'break-all',
            lineHeight: 1.2,
            marginTop: 2,
          }}
        >
          {label.sealNo}
        </div>
        {label.codePrefix && label.codeSeq ? (
          <div style={{ fontSize: 10, color: GREY, fontWeight: 600, letterSpacing: 0.3 }}>
            <span style={{ color: INK, fontWeight: 800 }}>{label.codePrefix}</span>
            <span style={{ margin: '0 4px', opacity: 0.5 }}>+</span>
            <span>{label.codeSeq}</span>
          </div>
        ) : null}
      </div>

      {label.origin ? (
        <div
          style={{
            borderTop: line,
            padding: '6px 10px',
            fontSize: 9,
            color: GREY,
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          From {label.origin}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Foldable mirrored seal tag preview.
 * Fold along the dashed line; bottom face is printed upside-down so both sides
 * of the bag tag show an upright barcode after folding.
 */
export function SealLabelNote({ seal, lookups, pack }) {
  const label = useMemo(() => normalizeSealLabel(seal, lookups, pack), [seal, lookups, pack])

  if (!label.sealNo) {
    return (
      <div style={{ padding: 16, color: GREY, border: `1px dashed ${GREY}`, borderRadius: 8 }}>
        Load a seal to preview its label.
      </div>
    )
  }

  return (
    <div
      className="seal-label-note"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: 340,
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafc',
      }}
    >
      <div style={{ fontSize: 10, color: GREY, textAlign: 'center', marginBottom: 6, fontWeight: 600 }}>
        Foldable bag tag · fold on dashed line · both sides scannable
      </div>
      <SealLabelFace label={label} barcodeEl={<BarcodeSvg value={label.sealNo} height={52} />} />
      <div
        style={{
          borderTop: `2px dashed ${GREY}`,
          borderBottom: `2px dashed ${GREY}`,
          padding: '4px 0',
          textAlign: 'center',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1.2,
          color: GREY,
          textTransform: 'uppercase',
          background: '#fff',
        }}
      >
        ✂ Fold here · stick onto bag tag
      </div>
      <div style={{ transform: 'rotate(180deg)' }}>
        <SealLabelFace label={label} barcodeEl={<BarcodeSvg value={label.sealNo} height={52} />} />
      </div>
    </div>
  )
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function faceHtml(label, barcode, { rotated = false } = {}) {
  const logoAbs = typeof window !== 'undefined'
    ? `${window.location.origin}${LOGO_SRC}`
    : LOGO_SRC
  const splitHint = label.codePrefix && label.codeSeq
    ? `<div class="split"><span class="pfx">${escapeHtml(label.codePrefix)}</span><span class="plus">+</span><span>${escapeHtml(label.codeSeq)}</span></div>`
    : ''
  const cnHint = label.cnCount > 0
    ? `<div style="font-size:9px;color:#4B5563;margin-top:2px">${label.cnCount} CN in bag</div>`
    : ''
  const origin = label.origin
    ? `<div class="origin">From ${escapeHtml(label.origin)}</div>`
    : ''

  return `<div class="face${rotated ? ' face-back' : ''}">
  <div class="row">
    <div class="cell br"><img src="${escapeHtml(logoAbs)}" alt="IPOSB" style="max-height:30px;max-width:100%;object-fit:contain" /></div>
    <div class="cell">
      <div style="font-size:12px;font-weight:900;letter-spacing:.6px">${escapeHtml(label.tierTitle)}</div>
      ${cnHint}
    </div>
  </div>
  <div class="scan">
    <div class="cap">SCAN SEAL</div>
    ${barcode || `<div class="mono code">${escapeHtml(label.sealNo)}</div>`}
    <div class="mono code">${escapeHtml(label.sealNo)}</div>
    ${splitHint}
  </div>
  ${origin}
</div>`
}

/** Self-contained foldable print HTML — two mirrored faces, fold on dashed line. */
export function buildSealLabelPrintHtml(seal, lookups = {}, pack = null) {
  const label = normalizeSealLabel(seal, lookups, pack)
  if (!label.sealNo) return ''
  const barcode = barcodeSvgHtml(label.sealNo, 52)

  return `<!doctype html><html><head>
<meta charset="utf-8" />
<title>${escapeHtml(label.sealNo)}</title>
<style>
  @page { margin: 6mm; size: auto; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Inter, Segoe UI, Arial, sans-serif; color: #000; display: flex; justify-content: center; padding: 8px; }
  .tag { width: 100%; max-width: 320px; }
  .hint { text-align: center; font-size: 9px; color: #4B5563; font-weight: 600; margin-bottom: 6px; }
  .face { border: 2px solid #000; background: #fff; box-sizing: border-box; display: flex; flex-direction: column; min-height: 200px; }
  .face-back { transform: rotate(180deg); }
  .fold {
    border-top: 2px dashed #6B7280; border-bottom: 2px dashed #6B7280;
    padding: 5px 0; text-align: center; font-size: 9px; font-weight: 800;
    letter-spacing: 1px; color: #6B7280; text-transform: uppercase; background: #fff;
  }
  .row { display: grid; grid-template-columns: 1fr 1.15fr; border-bottom: 1.5px solid #000; }
  .cell { padding: 8px 10px; }
  .br { border-right: 1.5px solid #000; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .scan {
    flex: 1 1 auto; padding: 14px 12px 12px; text-align: center;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  }
  .code { font-weight: 900; font-size: 18px; letter-spacing: 1px; word-break: break-all; line-height: 1.2; margin-top: 2px; }
  .split { font-size: 10px; color: #4B5563; font-weight: 600; letter-spacing: .3px; }
  .split .pfx { color: #000; font-weight: 800; }
  .split .plus { margin: 0 4px; opacity: .5; }
  .origin { border-top: 1.5px solid #000; padding: 6px 10px; font-size: 9px; color: #4B5563; text-align: center; font-weight: 600; }
  .cap { font-size: 8px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #4B5563; }
  @media print { body { padding: 0; } .hint { display: none; } }
</style>
</head><body>
<div class="tag">
  <div class="hint">Foldable bag tag · fold on dashed line · both sides scannable</div>
  ${faceHtml(label, barcode, { rotated: false })}
  <div class="fold">✂ Fold here · stick onto bag tag</div>
  ${faceHtml(label, barcode, { rotated: true })}
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},200)}</script>
</body></html>`
}

/** Open a print window with barcode baked into HTML. */
export function printSealLabel(seal, lookups, pack = null) {
  const html = buildSealLabelPrintHtml(seal, lookups, pack)
  if (!html) return
  const w = window.open('', '_blank', 'width=480,height=900')
  if (!w) {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch { /* ignore */ }
      setTimeout(() => iframe.remove(), 1000)
    }, 300)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

export default SealLabelNote
