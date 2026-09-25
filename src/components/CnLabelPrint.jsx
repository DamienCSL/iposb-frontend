import { useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

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

function transportLabel(row) {
  return (
    pick(row, 'transport_mode_label', 'transportModeLabel')
    || pick(row, 'transport_mode', 'transportMode', 'linehaul_mode')
    || 'Road'
  )
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
    receiverAddress: address || remarkRaw || '—',
    pcs: pick(row, 'cn_pcs', 'cnPcs') || '1',
    weight: pick(row, 'cn_wt', 'cnWt') || '0',
    pkg: pkgLabel(pick(row, 'pkg_typ', 'pkgTyp')),
    transport: transportLabel(row),
    remark: remark || '',
    trackingUrl: pick(row, 'tracking_url', 'trackingUrl') || '',
  }
}

function BarcodeSvg({ value, height = 36 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height,
        width: 1.4,
        background: 'transparent',
      })
    } catch {
      /* invalid characters — leave blank */
    }
  }, [value, height])
  return <svg ref={ref} style={{ width: '100%', maxWidth: '100%', height }} />
}

/** First-mile node | barcode | last-mile node */
function BarcodeWithNodes({ cn, firstMile, lastMile, height = 36, compact = false }) {
  const nodeStyle = {
    flex: '0 0 auto',
    minWidth: compact ? 44 : 56,
    maxWidth: compact ? 72 : 96,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontWeight: 800,
    fontSize: compact ? 10 : 12,
    lineHeight: 1.1,
    letterSpacing: 0.3,
    textAlign: 'center',
    wordBreak: 'break-all',
    color: '#0F1B2D',
  }
  const wing = (code, align) => (
    <div
      style={{
        ...nodeStyle,
        textAlign: align,
        border: '1.5px solid #0F1B2D',
        borderRadius: 3,
        padding: compact ? '4px 3px' : '6px 4px',
        background: '#F8FAFC',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'stretch',
      }}
      title={align === 'left' ? 'First-mile origin node' : 'Last-mile destination node'}
    >
      {code || '—'}
    </div>
  )

  return (
    <div
      className="cn-label-barcode-row"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: compact ? 4 : 6,
        width: '100%',
        marginTop: 4,
      }}
    >
      {wing(firstMile, 'left')}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderTop: '1px solid #E2E8F0',
          borderBottom: '1px solid #E2E8F0',
          padding: compact ? '2px 0' : '4px 0',
        }}
      >
        <BarcodeSvg value={cn} height={height} />
      </div>
      {wing(lastMile, 'right')}
    </div>
  )
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
      color: { dark: '#0F1B2D', light: '#FFFFFF' },
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
    return (
      <div
        style={{
          width: size,
          height: size,
          border: '1px dashed #CBD5E1',
          borderRadius: 4,
          background: '#F8FAFC',
        }}
      />
    )
  }
  return <img src={src} alt="QR" width={size} height={size} style={{ display: 'block' }} />
}

/** Single cuttable consignment note (used by A5 and A4 4-up). */
export function CnLabelNote({ row, compact = false, trackingBase }) {
  const label = useMemo(() => {
    const n = normalizeCnLabel(row)
    if (!n.trackingUrl && n.cn) {
      const base = (trackingBase || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
      n.trackingUrl = `${base}/ops/consignments/tracking?cn=${encodeURIComponent(n.cn)}`
    }
    return n
  }, [row, trackingBase])

  const pad = compact ? 8 : 12
  const qrSize = compact ? 52 : 68
  const barcodeH = compact ? 28 : 36

  return (
    <div
      className="cn-label-note"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        border: '1.5px solid #0F1B2D',
        borderRadius: 6,
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 6 : 8,
        background: '#fff',
        color: '#0F1B2D',
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: compact ? 11 : 13, fontWeight: 800, letterSpacing: 0.4, color: '#1B8A5A' }}>
            IPOSB Consignment
          </div>
          <div
            style={{
              fontSize: compact ? 16 : 20,
              fontWeight: 800,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              lineHeight: 1.15,
              marginTop: 2,
            }}
          >
            {label.displayCn || label.cn || '—'}
          </div>
          {label.partnerCn && label.cn && label.partnerCn !== label.cn ? (
            <div style={{ fontSize: compact ? 10 : 11, color: '#64748B', marginTop: 2 }}>
              IPOSB {label.cn}
              {label.partnerCode ? ` · ${label.partnerCode}` : ''}
            </div>
          ) : null}
          <div style={{ fontSize: compact ? 10 : 11, color: '#475569', marginTop: 2 }}>
            {label.origin} → {label.dest}
            <span style={{ margin: '0 6px', color: '#CBD5E1' }}>|</span>
            {label.date}
          </div>
          <BarcodeWithNodes
            cn={label.cn}
            firstMile={label.firstMile}
            lastMile={label.lastMile}
            height={barcodeH}
            compact={compact}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <QrImg value={label.trackingUrl || label.cn} size={qrSize} />
          <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>Scan to track</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: compact ? 6 : 8,
          borderTop: '1px solid #E2E8F0',
          borderBottom: '1px solid #E2E8F0',
          padding: compact ? '6px 0' : '8px 0',
          flex: 1,
          minHeight: 0,
        }}
      >
        <PartyBlock
          title="Sender"
          compact={compact}
          lines={[
            label.senderName,
            `Tel: ${label.senderPhone}`,
            label.senderAddress,
            `Acc: ${label.account}${label.accountName ? ` · ${label.accountName}` : ''}`,
          ]}
        />
        <PartyBlock
          title="Receiver"
          compact={compact}
          accent
          lines={[
            label.receiverShop !== label.receiverName ? label.receiverShop : null,
            label.receiverName,
            `Tel: ${label.receiverPhone}`,
            label.receiverAddress,
          ].filter(Boolean)}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
          fontSize: compact ? 10 : 11,
        }}
      >
        <MetaChip label="Pcs" value={label.pcs} compact={compact} />
        <MetaChip label="Kg" value={label.weight} compact={compact} />
        <MetaChip label="Type" value={label.pkg} compact={compact} />
        <MetaChip label="Mode" value={label.transport} compact={compact} />
      </div>

      <div style={{ fontSize: compact ? 10 : 11, color: '#334155' }}>
        <strong>Remark:</strong> {label.remark || '—'}
      </div>

      <div
        style={{
          marginTop: 'auto',
          borderTop: '1px dashed #94A3B8',
          paddingTop: compact ? 6 : 8,
          fontSize: compact ? 9 : 10,
          color: '#475569',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 0.8fr',
          gap: 6,
        }}
      >
        <div>POD / Receiver: ____________________</div>
        <div>Staff ID: ________</div>
        <div>Time: ______</div>
      </div>
    </div>
  )
}

function PartyBlock({ title, lines, compact, accent }) {
  return (
    <div
      style={{
        background: accent ? '#F0FDF4' : '#F8FAFC',
        borderRadius: 4,
        padding: compact ? 6 : 8,
        border: accent ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: compact ? 9 : 10,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: accent ? '#166534' : '#64748B',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {lines.map((line, i) => (
        <div
          key={`${title}-${i}`}
          style={{
            fontSize: compact ? 10 : 11,
            fontWeight: i === 0 ? 700 : 400,
            lineHeight: 1.25,
            wordBreak: 'break-word',
            marginBottom: 2,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

function MetaChip({ label, value, compact }) {
  return (
    <div
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: 4,
        padding: compact ? '3px 4px' : '4px 6px',
        background: '#F8FAFC',
      }}
    >
      <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
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
