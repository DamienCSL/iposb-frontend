import { useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

const INK = '#000000'
const MUTED = '#4B5563'
const LOGO_SRC = '/iposb-logo.png'
const TAGLINE = 'Enabling Commerce . Enriching Lives'

function pick(row, ...keys) {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function formatDate(raw) {
  const s = String(raw || '').trim()
  if (!s) return '—'
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

function pkgLabel(pkg) {
  const p = String(pkg || '').toUpperCase()
  if (p === 'D' || p.startsWith('DOC')) return 'Document'
  return 'Parcel'
}

function serviceLabel(code) {
  const c = String(code || '').toUpperCase()
  if (!c || c === 'STD') return 'STANDARD'
  if (c === 'EXP') return 'EXPRESS'
  if (c === 'SDD') return 'SAME DAY'
  if (c === 'NDD') return 'NEXT DAY'
  return c
}

function transportLabel(row) {
  return (
    pick(row, 'transport_mode_label', 'transportModeLabel')
    || pick(row, 'transport_mode', 'transportMode', 'linehaul_mode')
    || 'Road'
  )
}

function money(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

/**
 * Public tracking link for the QR. Set VITE_PUBLIC_TRACKING_URL (e.g. "https://iposb.my/track?cn={cn}")
 * once a customer-facing tracking page exists; otherwise falls back to the ops tracking page.
 */
function buildTrackingUrl(cn, trackingBase) {
  const tpl = String(import.meta.env?.VITE_PUBLIC_TRACKING_URL || '').trim()
  if (tpl) {
    return tpl.includes('{cn}') ? tpl.replace('{cn}', encodeURIComponent(cn)) : `${tpl}${encodeURIComponent(cn)}`
  }
  const base = (trackingBase || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  return `${base}/ops/consignments/tracking?cn=${encodeURIComponent(cn)}`
}

export function normalizeCnLabel(row) {
  const iposb = pick(row, 'iposb_cn_no', 'iposbCnNo', 'consignment_no', 'consignmentNo').toUpperCase()
    || pick(row, 'cn_no', 'cnNo').toUpperCase()
  const partnerCn = pick(row, 'partner_cn_no', 'partnerCnNo').toUpperCase()
  const partnerCode = pick(row, 'partner_code', 'partnerCode').toUpperCase()
  // Barcode / QR always use IPOSB CN; display may prefer partner AWB
  const cn = iposb || pick(row, 'cn_no', 'cnNo').toUpperCase()
  const displayCn = partnerCn || cn
  const receiverName = pick(row, 'recp_name', 'recpName', 'consignee', 'receiver_name')
  const shopName = pick(row, 'receiver_shop', 'shop_name', 'consignee_shop') || receiverName
  const address = pick(row, 'delivery_address', 'deliveryAddress', 'receiver_address')
  const remarkRaw = pick(row, 'remarks', 'note')
  const remark = address && remarkRaw && address === remarkRaw ? '' : remarkRaw
  const postcode = pick(row, 'receiver_postcode', 'receiverPostcode')
  const city = pick(row, 'receiver_city', 'receiverCity')
  const firstMile =
    pick(row, 'first_mile_node', 'firstMileNode', 'origin_drop_code', 'originDropCode', 'origin_zone', 'originZone').toUpperCase()
    || pick(row, 'cn_origin', 'cnOrigin').toUpperCase()
    || '—'
  const lastMile =
    pick(
      row,
      'last_mile_node',
      'lastMileNode',
      'destination_area_code',
      'destinationAreaCode',
      'destination_zone',
      'destinationZone',
    ).toUpperCase()
    || pick(row, 'cn_dstn', 'cnDstn').toUpperCase()
    || '—'
  const destService = pick(row, 'destination_service', 'destinationService').toUpperCase()
  const payMode = pick(row, 'ppd_cct', 'pay_typ', 'payMode').toUpperCase()
  const isCod = row?.is_cod === true || row?.is_cod === 1 || row?.is_cod === '1' || payMode === 'COD'
  const addressLine = [address || remarkRaw, [postcode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return {
    cn,
    displayCn,
    partnerCode: partnerCode || '',
    partnerCn: partnerCn || '',
    date: formatDate(pick(row, 'pu_dt', 'cn_date', 'cn_dt_tm', 'invoice_date')),
    origin: pick(row, 'cn_origin', 'cnOrigin').toUpperCase() || '—',
    dest: pick(row, 'cn_dstn', 'cnDstn').toUpperCase() || '—',
    firstMile,
    lastMile,
    account: pick(row, 'cust_ac_no', 'custAcNo') || '—',
    accountName: pick(row, 'cust_name', 'custName'),
    senderName: pick(row, 'consigner', 'sender_name') || '—',
    senderPhone: pick(row, 'sender_phone', 'senderPhone', 'cust_tel') || '—',
    senderAddress: pick(row, 'sender_address', 'senderAddress') || '—',
    receiverShop: shopName || '—',
    receiverName: receiverName || '—',
    receiverPhone: pick(row, 'receiver_phone', 'recp_phone', 'consignee_phone', 'callback_phone') || '—',
    receiverAddress: addressLine || '—',
    pcs: pick(row, 'cn_pcs', 'cnPcs') || '1',
    weight: pick(row, 'cn_wt', 'cnWt') || '0',
    pkg: pkgLabel(pick(row, 'pkg_typ', 'pkgTyp')),
    transport: transportLabel(row),
    service: serviceLabel(pick(row, 'srv_typ', 'srvTyp', 'service_type')),
    selfCollect: destService === 'SELF_COLLECT',
    collectCode: pick(row, 'dest_drop_code', 'destDropCode').toUpperCase(),
    collectName: pick(row, 'dest_drop_name', 'destDropName'),
    collectAddress: pick(row, 'dest_drop_address', 'destDropAddress'),
    isCod,
    codAmount: money(pick(row, 'cod_collect_amt', 'codCollectAmt', 'cash_amt', 'cashAmt') || 0),
    remark: remark || '',
    trackingUrl: pick(row, 'tracking_url', 'trackingUrl') || '',
  }
}

function BarcodeSvg({ value, height = 44 }) {
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
  return <svg ref={ref} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }} />
}

function QrImg({ value, size = 64 }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let cancelled = false
    if (!value) {
      setSrc('')
      return undefined
    }
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: size * 2,
      color: { dark: INK, light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!src) {
    return <div style={{ width: size, height: size, border: `1px dashed ${MUTED}` }} />
  }
  return <img src={src} alt="QR" width={size} height={size} style={{ display: 'block' }} />
}

const clamp = (lines) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
})

function SectionLabel({ children, s }) {
  return (
    <div
      style={{
        fontSize: s(8, 9),
        fontWeight: 800,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: MUTED,
        marginBottom: s(1, 2),
      }}
    >
      {children}
    </div>
  )
}

/** Single cuttable consignment note (used by A5 and A4 4-up). */
export function CnLabelNote({ row, compact = false, trackingBase }) {
  const label = useMemo(() => {
    const n = normalizeCnLabel(row)
    if (!n.trackingUrl && n.cn) n.trackingUrl = buildTrackingUrl(n.cn, trackingBase)
    return n
  }, [row, trackingBase])

  /** size helper: compact (A4 4-up) vs full (A5) */
  const s = (c, f) => (compact ? c : f)
  const line = `1.5px solid ${INK}`
  const cell = { padding: s('4px 6px', '6px 10px') }
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

  return (
    <div
      className="cn-label-note"
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
      {/* 1. Brand · service · payment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1.1fr', borderBottom: line }}>
        <div style={{ ...cell, display: 'flex', alignItems: 'center', borderRight: line }}>
          <img src={LOGO_SRC} alt="IPOSB" style={{ maxHeight: s(30, 42), maxWidth: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ ...cell, borderRight: line, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: s(12, 15), fontWeight: 900, letterSpacing: 0.5 }}>{label.service}</div>
          <div style={{ fontSize: s(9, 10), color: MUTED }}>{label.date}</div>
        </div>
        {label.isCod ? (
          <div
            style={{
              ...cell,
              background: INK,
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
          >
            <div style={{ fontSize: s(10, 12), fontWeight: 900, letterSpacing: 1 }}>COD</div>
            <div style={{ fontSize: s(13, 17), fontWeight: 900, lineHeight: 1.1 }}>RM {label.codAmount}</div>
          </div>
        ) : (
          <div style={{ ...cell, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: s(12, 15), fontWeight: 900, letterSpacing: 0.5 }}>PREPAID</div>
            <div style={{ fontSize: s(8, 9), color: MUTED }}>No cash to collect</div>
          </div>
        )}
      </div>

      {/* 2. Barcode + CN */}
      <div style={{ padding: s('6px 10px 4px', '10px 16px 6px'), borderBottom: line, textAlign: 'center' }}>
        <BarcodeSvg value={label.cn} height={s(38, 54)} />
        <div style={{ fontFamily: mono, fontWeight: 900, fontSize: s(15, 20), letterSpacing: 2, marginTop: s(3, 5) }}>
          {label.displayCn || label.cn || '—'}
        </div>
        {label.partnerCn && label.cn && label.partnerCn !== label.cn ? (
          <div style={{ fontSize: s(8, 10), color: MUTED }}>
            IPOSB {label.cn}
            {label.partnerCode ? ` · ${label.partnerCode}` : ''}
          </div>
        ) : null}
      </div>

      {/* 3. Sort strip (staff) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.1fr 1.6fr',
          background: INK,
          color: '#fff',
          borderBottom: line,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
        title="Sorting: first-mile node · hub route · last-mile node"
      >
        <div style={{ ...cell, borderRight: '1.5px solid #fff' }}>
          <div style={{ fontSize: s(7, 8), opacity: 0.75, letterSpacing: 0.5 }}>FROM NODE</div>
          <div style={{ fontFamily: mono, fontWeight: 800, fontSize: s(11, 13), wordBreak: 'break-all' }}>{label.firstMile}</div>
        </div>
        <div style={{ ...cell, borderRight: '1.5px solid #fff' }}>
          <div style={{ fontSize: s(7, 8), opacity: 0.75, letterSpacing: 0.5 }}>HUB ROUTE</div>
          <div style={{ fontFamily: mono, fontWeight: 800, fontSize: s(11, 13) }}>
            {label.origin} → {label.dest}
          </div>
        </div>
        <div style={{ ...cell, textAlign: 'center' }}>
          <div style={{ fontSize: s(7, 8), opacity: 0.75, letterSpacing: 0.5 }}>DELIVER TO NODE</div>
          <div style={{ fontFamily: mono, fontWeight: 900, fontSize: s(18, 26), lineHeight: 1.05, wordBreak: 'break-all' }}>
            {label.lastMile}
          </div>
        </div>
      </div>

      {/* 4. Receiver */}
      <div style={{ ...cell, borderBottom: line, flex: '0 1 auto', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <SectionLabel s={s}>To (Receiver)</SectionLabel>
          <span
            style={{
              border: `1.5px solid ${INK}`,
              borderRadius: 3,
              padding: s('0 4px', '1px 6px'),
              fontSize: s(8, 10),
              fontWeight: 900,
              letterSpacing: 0.4,
              whiteSpace: 'nowrap',
            }}
          >
            {label.selfCollect ? 'SELF-COLLECT' : 'HOME DELIVERY'}
          </span>
        </div>
        {label.receiverShop !== label.receiverName && label.receiverShop !== '—' ? (
          <div style={{ fontSize: s(10, 12), fontWeight: 700, ...clamp(1) }}>{label.receiverShop}</div>
        ) : null}
        <div style={{ fontSize: s(14, 22), fontWeight: 900, lineHeight: 1.15, marginTop: s(0, 2), ...clamp(1) }}>{label.receiverName}</div>
        <div style={{ fontSize: s(12, 17), fontWeight: 800, marginTop: s(1, 3) }}>{label.receiverPhone}</div>
        <div style={{ fontSize: s(10.5, 15), lineHeight: 1.35, marginTop: s(2, 5), ...clamp(compact ? 3 : 4) }}>{label.receiverAddress}</div>
        {label.selfCollect ? (
          <div
            style={{
              marginTop: s(3, 8),
              border: `1px dashed ${INK}`,
              padding: s('2px 5px', '6px 10px'),
              fontSize: s(9, 13),
              lineHeight: 1.3,
            }}
          >
            <strong>Collect at:</strong>{' '}
            {label.collectCode || label.collectName
              ? [label.collectCode, label.collectName].filter(Boolean).join(' · ')
              : 'Drop point to be assigned — we will notify you'}
            {label.collectAddress ? <div style={clamp(1)}>{label.collectAddress}</div> : null}
          </div>
        ) : null}
      </div>

      {/* 5. Sender */}
      <div style={{ ...cell, borderBottom: line }}>
        <SectionLabel s={s}>From (Sender)</SectionLabel>
        <div style={{ fontSize: s(10, 13), lineHeight: 1.3, ...clamp(1) }}>
          <strong>{label.senderName}</strong> · {label.senderPhone}
        </div>
        <div style={{ fontSize: s(9, 12), color: MUTED, lineHeight: 1.3, ...clamp(compact ? 1 : 2) }}>{label.senderAddress}</div>
      </div>

      {/* 6. Parcel info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: line }}>
        {[
          ['Pieces', label.pcs],
          ['Weight', `${label.weight} kg`],
          ['Type', label.pkg],
          ['Mode', label.transport],
        ].map(([k, v], i) => (
          <div key={k} style={{ padding: s('3px 5px', '5px 8px'), borderRight: i < 3 ? line : 'none' }}>
            <div style={{ fontSize: s(7, 8), color: MUTED, fontWeight: 700, textTransform: 'uppercase' }}>{k}</div>
            <div style={{ fontSize: s(11, 13), fontWeight: 800, ...clamp(1) }}>{v}</div>
          </div>
        ))}
      </div>

      {/* 7. Remark */}
      {label.remark ? (
        <div style={{ ...cell, borderBottom: line, fontSize: s(9, 11), ...clamp(1) }}>
          <strong>Remark:</strong> {label.remark}
        </div>
      ) : null}

      {/* 8. POD + QR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', borderBottom: line, flex: '1 1 auto', minHeight: 0 }}>
        <div style={{ ...cell, borderRight: line, display: 'flex', flexDirection: 'column', gap: s(5, 8), fontSize: s(8, 10) }}>
          <SectionLabel s={s}>Proof of delivery</SectionLabel>
          <div
            style={{
              flex: '1 1 auto',
              minHeight: s(22, 40),
              border: `1px solid ${INK}`,
              padding: '2px 4px',
              color: MUTED,
            }}
          >
            Receiver signature
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8 }}>
            <div style={{ borderBottom: `1px solid ${INK}`, paddingBottom: 1 }}>Name / IC</div>
            <div style={{ borderBottom: `1px solid ${INK}`, paddingBottom: 1 }}>Date &amp; time</div>
          </div>
          <div style={{ borderBottom: `1px solid ${INK}`, paddingBottom: 1 }}>Staff ID</div>
        </div>
        <div style={{ ...cell, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <QrImg value={label.trackingUrl || label.cn} size={s(58, 104)} />
          <div style={{ fontSize: s(7, 9), fontWeight: 700, marginTop: 2 }}>Scan to track</div>
        </div>
      </div>

      {/* 9. Footer */}
      <div
        style={{
          padding: s('3px 6px', '4px 10px'),
          fontSize: s(7, 9),
          color: MUTED,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <span style={clamp(1)}>
          Acc {label.account}
          {label.accountName ? ` · ${label.accountName}` : ''}
        </span>
        <span style={{ fontStyle: 'italic', whiteSpace: 'nowrap' }}>{TAGLINE}</span>
      </div>
    </div>
  )
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out.length ? out : [[]]
}

/**
 * Printable sheet(s):
 * - a5: one note per page
 * - a4-4: 2×2 cuttable grid (4 notes per A4 page)
 */
export default function CnLabelPrint({ rows, format = 'a5', trackingBase }) {
  const notes = (rows || []).filter(Boolean)

  if (format === 'a4-4') {
    const sheets = chunk(notes, 4)
    return (
      <div className="cn-label-print-root">
        {sheets.map((sheetRows, sheetIdx) => {
          const filled = [...sheetRows, ...Array(Math.max(0, 4 - sheetRows.length)).fill(null)].slice(0, 4)
          return (
            <div key={`sheet-${sheetIdx}`} className="cn-label-sheet cn-label-a4">
              <div className="cn-label-grid">
                {filled.map((row, idx) => (
                  <div
                    key={row ? `${normalizeCnLabel(row).cn}-${sheetIdx}-${idx}` : `empty-${sheetIdx}-${idx}`}
                    className="cn-label-cell"
                  >
                    {row ? (
                      <CnLabelNote row={row} compact trackingBase={trackingBase} />
                    ) : (
                      <div className="cn-label-empty">Empty slot</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (!notes.length) return null
  return (
    <div className="cn-label-print-root">
      {notes.map((row, idx) => (
        <div key={`${normalizeCnLabel(row).cn}-${idx}`} className="cn-label-sheet cn-label-a5">
          <div className="cn-label-a5-frame">
            <CnLabelNote row={row} trackingBase={trackingBase} />
          </div>
        </div>
      ))}
    </div>
  )
}
