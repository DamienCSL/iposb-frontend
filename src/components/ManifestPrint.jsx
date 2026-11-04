import React, { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

const INK = '#0F1B2D'
const GREY = '#64748B'
const LINE = '#CBD5E1'
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v != null && String(v).trim() !== '') return v
  }
  return ''
}

function BarcodeSvg({ value, height = 56, maxWidth = 420 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, String(value).toUpperCase(), {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height,
        width: 1.6,
        background: '#ffffff',
        lineColor: INK,
      })
    } catch {
      /* ignore invalid */
    }
  }, [value, height])

  return (
    <svg
      ref={ref}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', maxWidth, height, display: 'block' }}
    />
  )
}

function MetaCell({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9, letterSpacing: 0.6, color: GREY, textTransform: 'uppercase', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2, wordBreak: 'break-word' }}>
        {children || '—'}
      </div>
    </div>
  )
}

/**
 * Landscape A4 print for:
 * - consignment_manifest (MFG): seals as units + loose CNs
 * - seal_manifest (baby seal): every CN inside the seal
 */
export default function ManifestPrint({ data }) {
  const row = data?.row || {}
  const lines = Array.isArray(data?.lines) ? data.lines : []
  const summary = data?.summary || {}
  const docType = String(data?.documentType || data?.kind || '').toLowerCase()
  const isSealManifest =
    docType === 'seal_manifest' ||
    docType === 'seal-manifest' ||
    docType === 'seal'

  const mfgNo = String(pick(row, 'mfg_no', 'mfgNo', 'seal_no', 'sealNo', 'barcode') || '').toUpperCase()
  const plate = String(pick(row, 'vehicle_no', 'vehicleNo') || '').toUpperCase()
  const origin = String(pick(row, 'loc_id', 'locId') || '').toUpperCase()
  const dest = String(pick(row, 'dest_loc', 'destLoc', 'dest_area_code') || '').toUpperCase()
  const date = String(pick(row, 'mfg_dt', 'mfgDt') || '').slice(0, 10)
  const status = String(pick(row, 'mfg_status', 'mfgStatus') || '').toUpperCase()
  const carrier = String(pick(row, 'carrier') || '')
  const driver = String(pick(row, 'driver_name', 'driverName') || '')
  const remarks = String(pick(row, 'remarks') || '')
  const summaryText = String(summary.text || row.summary_text || '')
  const docTitle = isSealManifest ? 'MANIFEST' : 'CONSIGNMENT MANIFEST'
  const barcodeCaption = isSealManifest
    ? 'Seal barcode (CODE128)'
    : 'Consignment manifesto barcode (CODE128)'

  const totalPcs = summary.totalPcs ?? lines.reduce((s, l) => s + (Number(l.pcs) || 0), 0)
  const totalWt = summary.totalWtKg ?? lines.reduce((s, l) => s + (Number(l.wt_kg) || 0), 0)
  const sealCount = summary.sealCount ?? lines.filter((l) => String(l.line_type || '').toLowerCase() === 'seal').length
  const looseCn = summary.looseCnCount ?? lines.filter((l) => String(l.pack_type || '').toUpperCase() === 'LOOSE').length
  const cnInside = summary.cnCount ?? lines.length

  return (
    <div className="manifest-print-root">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
        }
        .manifest-sheet {
          width: 277mm;
          min-height: 190mm;
          margin: 0 auto;
          background: #fff;
          color: ${INK};
          box-sizing: border-box;
          padding: 10mm 10mm 8mm;
          font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
        }
        @media screen {
          .manifest-sheet {
            box-shadow: 0 8px 28px rgba(15,27,45,0.12);
            border-radius: 6px;
            margin-bottom: 16px;
          }
        }
        .manifest-sheet table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .manifest-sheet th,
        .manifest-sheet td {
          border: 1px solid ${LINE};
          padding: 3px 5px;
          font-size: 10px;
          vertical-align: top;
          word-break: break-word;
        }
        .manifest-sheet th {
          background: #F1F5F9;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 800;
          color: ${INK};
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .manifest-sheet tbody tr:nth-child(even) td {
          background: #FAFBFC;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>

      <div className="manifest-sheet">
        {/* Header band */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.4fr 1fr',
            gap: 12,
            alignItems: 'start',
            borderBottom: `2px solid ${INK}`,
            paddingBottom: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: GREY }}>IPOSB LOGISTICS</div>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>{docTitle}</div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4, fontFamily: mono }}>
              {origin || '—'} → {dest || '—'}
            </div>
            <div style={{ fontSize: 11, color: GREY, marginTop: 4 }}>
              Date {date || '—'} · Status <strong style={{ color: INK }}>{status || '—'}</strong>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <BarcodeSvg value={mfgNo} height={58} maxWidth={460} />
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 900, letterSpacing: 1, marginTop: 4 }}>
              {mfgNo || '—'}
            </div>
            <div style={{ fontSize: 9, color: GREY, marginTop: 2 }}>{barcodeCaption}</div>
          </div>

          <div
            style={{
              border: `1.5px solid ${INK}`,
              borderRadius: 6,
              padding: '8px 10px',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.8, color: GREY }}>VEHICLE / PLATE</div>
            <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 900, marginTop: 2 }}>
              {plate || '—'}
            </div>
            <div style={{ fontSize: 10, marginTop: 6, color: GREY }}>
              Driver: <strong style={{ color: INK }}>{driver || '—'}</strong>
            </div>
            <div style={{ fontSize: 10, color: GREY }}>
              Carrier: <strong style={{ color: INK }}>{carrier || '—'}</strong>
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10,
            marginBottom: 8,
            padding: '6px 0',
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <MetaCell label="Origin">{origin}</MetaCell>
          <MetaCell label="Destination">{dest}</MetaCell>
          <MetaCell label={isSealManifest ? 'Seal No' : 'Manifesto No'}>
            <span style={{ fontFamily: mono }}>{mfgNo}</span>
          </MetaCell>
          <MetaCell label="Plate No">
            <span style={{ fontFamily: mono }}>{plate || '—'}</span>
          </MetaCell>
          <MetaCell label="Printed">{new Date().toLocaleString()}</MetaCell>
        </div>

        {/* Summary banner */}
        <div
          style={{
            background: INK,
            color: '#fff',
            borderRadius: 4,
            padding: '7px 12px',
            marginBottom: 8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            alignItems: 'center',
            fontSize: 12,
            fontWeight: 700,
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
        >
          <span>
            {summaryText ||
              (isSealManifest
                ? `${cnInside} CN in seal`
                : `${sealCount} SEAL + ${looseCn} LOOSE`)}
          </span>
          <span style={{ opacity: 0.85 }}>|</span>
          <span>{isSealManifest ? `${lines.length} CN` : `${lines.length} line(s)`}</span>
          <span style={{ opacity: 0.85 }}>|</span>
          <span>{totalPcs} pcs</span>
          <span style={{ opacity: 0.85 }}>|</span>
          <span>{Number(totalWt || 0).toFixed(3)} KG</span>
          {summary.codCount > 0 ? (
            <>
              <span style={{ opacity: 0.85 }}>|</span>
              <span>{summary.codCount} COD</span>
            </>
          ) : null}
        </div>

        {remarks ? (
          <div style={{ fontSize: 11, marginBottom: 8, color: GREY }}>
            <strong style={{ color: INK }}>Remarks:</strong> {remarks}
          </div>
        ) : null}

        {/* Line table */}
        <table>
          <thead>
            <tr>
              <th style={{ width: '3%' }}>#</th>
              <th style={{ width: '16%' }}>
                {isSealManifest ? 'CN / Partner' : 'Item (Seal / CN)'}
              </th>
              <th style={{ width: '9%' }}>{isSealManifest ? 'Seal' : 'Type'}</th>
              <th style={{ width: '7%' }}>O → D</th>
              <th style={{ width: '12%' }}>Receiver</th>
              <th style={{ width: '16%' }}>Address / Note</th>
              <th style={{ width: '8%' }}>Phone</th>
              <th style={{ width: '4%' }}>Pcs</th>
              <th style={{ width: '6%' }}>Wt (kg)</th>
              <th style={{ width: '6%' }}>Pay</th>
              <th style={{ width: '7%' }}>Transport</th>
              <th style={{ width: '8%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', color: GREY, padding: 16 }}>
                  {isSealManifest
                    ? 'No consignments in this seal.'
                    : 'No seals or consignments on this manifesto.'}
                </td>
              </tr>
            ) : (
              lines.map((l) => {
                const isSealLine = String(l.line_type || '').toLowerCase() === 'seal'
                const partner = [l.partner_code, l.partner_cn_no].filter(Boolean).join(' ')
                const payLabel =
                  String(l.pay_mode || '').toUpperCase() === 'COD'
                    ? `COD${l.cash_amt != null ? ` ${Number(l.cash_amt).toFixed(2)}` : ''}`
                    : l.pay_mode || 'PPD'
                const itemNo = l.item_no || l.cn_no || l.seal_no
                return (
                  <tr key={`${l.no}-${itemNo}`}>
                    <td style={{ textAlign: 'center', fontFamily: mono }}>{l.no}</td>
                    <td>
                      <div style={{ fontFamily: mono, fontWeight: 800 }}>{itemNo}</div>
                      {isSealLine && l.cn_count != null ? (
                        <div style={{ fontSize: 9, color: GREY, marginTop: 1 }}>
                          {l.cn_count} CN in seal
                        </div>
                      ) : null}
                      {partner ? (
                        <div style={{ fontSize: 9, color: GREY, marginTop: 1 }}>{partner}</div>
                      ) : null}
                      {l.sender ? (
                        <div style={{ fontSize: 9, color: GREY, marginTop: 1 }}>From: {l.sender}</div>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        {l.pack_type || (isSealLine ? 'SEAL' : 'LOOSE')}
                      </div>
                      {!isSealLine && l.seal_no ? (
                        <div style={{ fontFamily: mono, fontSize: 9, marginTop: 1 }}>{l.seal_no}</div>
                      ) : null}
                    </td>
                    <td style={{ fontFamily: mono, fontWeight: 700 }}>
                      {(l.origin || '—')}→{(l.dest || '—')}
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.receiver || '—'}</td>
                    <td style={{ fontSize: 9.5, color: '#334155' }}>{l.address || '—'}</td>
                    <td style={{ fontFamily: mono, fontSize: 9.5 }}>{l.phone || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{l.pcs ?? 0}</td>
                    <td style={{ textAlign: 'right', fontFamily: mono }}>
                      {Number(l.wt_kg || 0).toFixed(3)}
                      {l.vol_wt != null ? (
                        <div style={{ fontSize: 8, color: GREY }}>vol {Number(l.vol_wt).toFixed(2)}</div>
                      ) : null}
                    </td>
                    <td style={{ fontWeight: 700 }}>{payLabel}</td>
                    <td>{l.transport || '—'}</td>
                    <td style={{ fontFamily: mono, fontSize: 9 }}>{l.status || '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Totals + signatures */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
            gap: 16,
            marginTop: 12,
            alignItems: 'end',
          }}
        >
          <div style={{ fontSize: 11 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Totals</div>
            <div>
              {isSealManifest ? (
                <>
                  CN <strong>{lines.length}</strong>
                </>
              ) : (
                <>
                  Lines <strong>{lines.length}</strong> · CN inside <strong>{cnInside}</strong>
                </>
              )}{' '}
              · Pcs <strong>{totalPcs}</strong> · Wt{' '}
              <strong>{Number(totalWt || 0).toFixed(3)} kg</strong>
              {summary.totalCbm > 0 ? (
                <>
                  {' '}
                  · CBM <strong>{Number(summary.totalCbm).toFixed(4)}</strong>
                </>
              ) : null}
            </div>
            {!isSealManifest ? (
              <div style={{ color: GREY, marginTop: 4, fontSize: 10 }}>
                Seals {sealCount} · Loose CN {looseCn}
              </div>
            ) : null}
          </div>
          {['Prepared by (Hub)', 'Driver / Plate confirm', 'Received by (Dest hub)'].map((label) => (
            <div key={label} style={{ borderTop: `1px solid ${INK}`, paddingTop: 6, minHeight: 48 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: GREY }}>{label}</div>
              <div style={{ fontSize: 10, color: GREY, marginTop: 18 }}>Name / Sign / Date</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
