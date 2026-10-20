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
      if (typ === 'seal' || key.startsWith('BS-') || key.startsWith('MS-') || key.startsWith('FS-')) {
        if (typ === 'seal' || (typ !== 'cn' && (key.startsWith('BS-') || key.startsWith('MS-') || key.startsWith('FS-')))) {
          push(key)
        }
      }
    }
  }
  return out
}

/**
 * Merge seal + pack into one label source so contents/barcode always have data.
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
 * Normalize seal → label fields.
 * Barcode value is always sealNo (BS-… / MS-… / FS-…) — what delivery nodes scan.
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

  let handOverCode = ''
  let handOverKind = 'NODE'
  if (tier === 'baby') {
    handOverCode = destArea || destDp
    handOverKind = destArea ? 'AREA' : 'DELIVERY POINT'
  } else if (tier === 'mother') {
    handOverCode = destDp || destArea
    handOverKind = 'DELIVERY POINT'
  } else if (tier === 'father') {
    handOverCode = destHub
    handOverKind = 'HUB'
  } else {
    handOverCode = destDp || destArea || destHub
  }

  const nameMap = lookups.names || {}
  const handOverName = handOverCode ? (nameMap[handOverCode] || '') : ''
  const contents = Array.isArray(source.leafConsignments)
    ? source.leafConsignments
    : sealContentCns(source, pack)
  const childSeals = Array.isArray(source._childSeals)
    ? source._childSeals
    : sealChildSealCodes(source, pack)

  return {
    sealNo,
    tier,
    tierTitle: tierTitle(tier),
    lifecycle: pick(source, 'lifecycle') || '',
    handOverKind,
    handOverCode: handOverCode || '—',
    handOverName,
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
export function barcodeSvgHtml(value, height = 54) {
  const code = String(value || '').trim().toUpperCase()
  if (!code || typeof document === 'undefined') return ''
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(svg, code, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height,
      width: 2,
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

function BarcodeSvg({ value, height = 52 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height,
        width: 2,
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
      style={{ width: '100%', maxWidth: 340, height, display: 'block', margin: '0 auto' }}
    />
  )
}

/** On-screen seal label — barcode, hand-over node, CN contents. */
export function SealLabelNote({ seal, lookups, pack }) {
  const label = useMemo(() => normalizeSealLabel(seal, lookups, pack), [seal, lookups, pack])
  const line = `1.5px solid ${INK}`
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  const inverted = {
    background: INK,
    color: '#fff',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  }

  const maxShow = 40
  const shown = label.contents.slice(0, maxShow)
  const more = Math.max(0, label.contents.length - shown.length)

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
        maxWidth: 380,
        border: `2px solid ${INK}`,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        color: INK,
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', borderBottom: line }}>
        <div style={{ padding: '8px 10px', borderRight: line, display: 'flex', alignItems: 'center' }}>
          <img src={LOGO_SRC} alt="IPOSB" style={{ maxHeight: 36, maxWidth: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 0.6 }}>{label.tierTitle}</div>
          <div style={{ fontSize: 10, color: GREY }}>{label.cnCount} CN · {label.memberCount} members</div>
        </div>
      </div>

      <div style={{ padding: '10px 14px 6px', borderBottom: line, textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.8, color: GREY, marginBottom: 4 }}>
          SCAN SEAL
        </div>
        <BarcodeSvg value={label.sealNo} height={54} />
        <div style={{ fontFamily: mono, fontWeight: 900, fontSize: 20, letterSpacing: 1.5, marginTop: 6 }}>
          {label.sealNo}
        </div>
      </div>

      <div style={{ ...inverted, padding: '10px 12px', borderBottom: line, textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, opacity: 0.8 }}>
          HAND OVER TO · {label.handOverKind}
        </div>
        <div style={{ fontFamily: mono, fontWeight: 900, fontSize: 28, lineHeight: 1.1, marginTop: 2, wordBreak: 'break-all' }}>
          {label.handOverCode}
        </div>
        {label.handOverName ? (
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{label.handOverName}</div>
        ) : null}
      </div>

      <div style={{ padding: '8px 12px 12px', flex: '1 1 auto' }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: GREY, textTransform: 'uppercase' }}>
          Contents · Consignment notes ({label.contents.length})
        </div>
        {shown.length === 0 && label.childSeals.length === 0 ? (
          <div style={{ fontSize: 12, color: GREY, marginTop: 6 }}>No consignments packed yet.</div>
        ) : (
          <div
            style={{
              marginTop: 6,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2px 10px',
              fontFamily: mono,
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {shown.map((cn) => (
              <div key={cn} style={{ wordBreak: 'break-all' }}>{cn}</div>
            ))}
          </div>
        )}
        {more > 0 ? (
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6 }}>+{more} more CN</div>
        ) : null}
        {label.childSeals.length > 0 ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: GREY, textTransform: 'uppercase' }}>
              Nested seals ({label.childSeals.length})
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, marginTop: 4 }}>
              {label.childSeals.join(' · ')}
            </div>
          </div>
        ) : null}
        {label.origin ? (
          <div style={{ fontSize: 10, color: GREY, marginTop: 10 }}>From {label.origin}</div>
        ) : null}
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

/** Self-contained print HTML (barcode baked in) — no React in the popup. */
export function buildSealLabelPrintHtml(seal, lookups = {}, pack = null) {
  const label = normalizeSealLabel(seal, lookups, pack)
  if (!label.sealNo) return ''
  const barcode = barcodeSvgHtml(label.sealNo, 54)
  const shown = label.contents.slice(0, 40)
  const more = Math.max(0, label.contents.length - shown.length)
  const cnCells = shown.map((cn) => `<div style="word-break:break-all">${escapeHtml(cn)}</div>`).join('')
  const logoAbs = typeof window !== 'undefined'
    ? `${window.location.origin}${LOGO_SRC}`
    : LOGO_SRC

  return `<!doctype html><html><head>
<meta charset="utf-8" />
<title>${escapeHtml(label.sealNo)}</title>
<style>
  @page { margin: 8mm; size: auto; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Inter, Segoe UI, Arial, sans-serif; color: #000; display: flex; justify-content: center; padding: 12px; }
  .label { width: 100%; max-width: 380px; border: 2px solid #000; }
  .row { display: grid; grid-template-columns: 1.2fr 1fr; border-bottom: 1.5px solid #000; }
  .cell { padding: 8px 10px; }
  .br { border-right: 1.5px solid #000; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .scan { padding: 10px 14px 6px; border-bottom: 1.5px solid #000; text-align: center; }
  .hand { background: #000; color: #fff; padding: 10px 12px; border-bottom: 1.5px solid #000; text-align: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .contents { padding: 8px 12px 12px; }
  .grid { margin-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; font-size: 11px; font-weight: 700; }
  .cap { font-size: 9px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: #4B5563; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<div class="label">
  <div class="row">
    <div class="cell br"><img src="${escapeHtml(logoAbs)}" alt="IPOSB" style="max-height:36px;max-width:100%;object-fit:contain" /></div>
    <div class="cell">
      <div style="font-size:13px;font-weight:900;letter-spacing:.6px">${escapeHtml(label.tierTitle)}</div>
      <div style="font-size:10px;color:#4B5563">${label.cnCount} CN · ${label.memberCount} members</div>
    </div>
  </div>
  <div class="scan">
    <div class="cap" style="margin-bottom:4px">SCAN SEAL</div>
    ${barcode || `<div class="mono" style="font-size:14px;font-weight:900">${escapeHtml(label.sealNo)}</div>`}
    <div class="mono" style="font-weight:900;font-size:20px;letter-spacing:1.5px;margin-top:6px">${escapeHtml(label.sealNo)}</div>
  </div>
  <div class="hand">
    <div style="font-size:9px;font-weight:800;letter-spacing:1px;opacity:.85">HAND OVER TO · ${escapeHtml(label.handOverKind)}</div>
    <div class="mono" style="font-weight:900;font-size:28px;line-height:1.1;margin-top:2px;word-break:break-all">${escapeHtml(label.handOverCode)}</div>
    ${label.handOverName ? `<div style="font-size:12px;font-weight:600;margin-top:2px">${escapeHtml(label.handOverName)}</div>` : ''}
  </div>
  <div class="contents">
    <div class="cap">Contents · Consignment notes (${label.contents.length})</div>
    ${shown.length === 0 && label.childSeals.length === 0
      ? '<div style="font-size:12px;color:#4B5563;margin-top:6px">No consignments packed yet.</div>'
      : `<div class="grid mono">${cnCells}</div>`}
    ${more > 0 ? `<div style="font-size:11px;font-weight:700;margin-top:6px">+${more} more CN</div>` : ''}
    ${label.childSeals.length
      ? `<div style="margin-top:10px"><div class="cap">Nested seals (${label.childSeals.length})</div>
         <div class="mono" style="font-size:11px;font-weight:700;margin-top:4px">${escapeHtml(label.childSeals.join(' · '))}</div></div>`
      : ''}
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print()},200)}</script>
</body></html>`
}

/** Open a print window with barcode + contents baked into HTML. */
export function printSealLabel(seal, lookups, pack = null) {
  const html = buildSealLabelPrintHtml(seal, lookups, pack)
  if (!html) return
  const w = window.open('', '_blank', 'width=480,height=720')
  if (!w) {
    // Popup blocked — fallback: print current document fragment
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
