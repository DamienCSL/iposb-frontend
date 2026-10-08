export const MODES = [
  { code: 'air', label: 'Air' },
  { code: 'road', label: 'Land' },
  { code: 'sea', label: 'Sea' },
]

export const FORMULAS = [
  {
    type: 'base_pcs_kg',
    slug: 'base',
    prefix: 'BASE',
    title: 'Base + pieces + kg',
    summary: 'Fee = Base + (pieces × RM/pc) + (kg × RM/kg). E.g. Land RM 1 per kg.',
  },
  {
    type: 'step_linear',
    slug: 'steps',
    prefix: 'STEP',
    title: 'Step / linear',
    summary: 'Flat early tiers, then a fixed amount for every extra step of kg (optional cap).',
  },
  {
    type: 'size_weight',
    slug: 'sizes',
    prefix: 'SIZE',
    title: 'Size tiers (by weight)',
    summary: 'Your own sizes by weight, a price per size, and an unlimited top size.',
  },
]

const PREFIXES = FORMULAS.map((f) => f.prefix).sort((a, b) => b.length - a.length)
const FORMULA_CODE_RE = new RegExp(`^(${PREFIXES.join('|')})-(AIR|ROAD|SEA)$`)

export const FORMULA_SORT_ORDER = -100
export const MAX_WEIGHT = 999999.99

export function formulaBySlug(slug) {
  return FORMULAS.find((f) => f.slug === slug) || null
}

export function formulaByType(type) {
  return FORMULAS.find((f) => f.type === type) || null
}

export function modeLabel(code) {
  return MODES.find((m) => m.code === code)?.label || code
}

export function normMode(m) {
  const v = String(m || '').toLowerCase()
  return v === 'land' ? 'road' : v
}

const up = (v) => String(v || '').trim().toUpperCase()

/** Who + where a price applies to. custAcNo '' = public. */
export function emptyTarget() {
  return { custAcNo: '', origin: '', destination: '', serviceType: '' }
}

export function normTarget(t) {
  return {
    custAcNo: up(t?.custAcNo),
    origin: up(t?.origin),
    destination: up(t?.destination),
    serviceType: up(t?.serviceType),
  }
}

export function laneKey(t) {
  const n = normTarget(t)
  return `${n.origin}|${n.destination}|${n.serviceType}`
}

export function isAllLanes(t) {
  return laneKey(t) === '||'
}

export function laneLabel(t) {
  const n = normTarget(t)
  if (isAllLanes(n)) return 'All lanes'
  const route = `${n.origin || 'Any'} → ${n.destination || 'Any'}`
  return n.serviceType ? `${route} · ${n.serviceType}` : route
}

export function scopeLabel(custAcNo) {
  return up(custAcNo) ? `Customer ${up(custAcNo)}` : 'Public'
}

export function rowTarget(row) {
  return normTarget({
    custAcNo: row.custAcNo,
    origin: row.origin,
    destination: row.destination,
    serviceType: row.serviceType,
  })
}

export function sameTarget(a, b) {
  const x = normTarget(a)
  const y = normTarget(b)
  return x.custAcNo === y.custAcNo && laneKey(x) === laneKey(y)
}

export function isFormulaRow(row) {
  return FORMULA_CODE_RE.test(up(row.rateCode))
}

export function rateCodeFor(formula, modeCode) {
  return `${formula.prefix}-${modeCode.toUpperCase()}`
}

/** The row a formula page owns for one target + mode. */
export function findFormulaRow(rows, formula, target, modeCode) {
  const code = rateCodeFor(formula, modeCode)
  return (
    rows.find(
      (r) =>
        up(r.rateCode) === code &&
        normMode(r.transportMode) === modeCode &&
        sameTarget(rowTarget(r), target),
    ) || null
  )
}

/** Active rows competing at exactly this target + mode. */
export function activeRowsAt(rows, target, modeCode) {
  return rows.filter(
    (r) => r.isActive && normMode(r.transportMode) === modeCode && sameTarget(rowTarget(r), target),
  )
}

export function describeRow(row) {
  if (isFormulaRow(row)) {
    return formulaByType(row.formulaType)?.title || row.rateCode
  }
  return `Old band ${row.rateCode}`
}

/** Distinct lanes used by any row in this scope (always includes All lanes). */
export function lanesForScope(rows, custAcNo) {
  const scope = up(custAcNo)
  const seen = new Map([['||', emptyTarget()]])
  rows.forEach((r) => {
    const t = rowTarget(r)
    if (t.custAcNo !== scope) return
    const key = laneKey(t)
    if (!seen.has(key)) seen.set(key, { ...t, custAcNo: '' })
  })
  return [...seen.entries()].map(([key, t]) => ({ key, target: t }))
}

export function customersWithRows(rows) {
  return [...new Set(rows.map((r) => up(r.custAcNo)).filter(Boolean))].sort()
}

/**
 * Build the rows to save for one formula page: the formula's own rows, plus competing
 * active rows at the same target + mode switched off (one formula per mode).
 */
export function buildSaveRows({ rows, formula, target, enabledModes, paramsForMode, description }) {
  const t = normTarget(target)
  const out = []
  MODES.forEach((m) => {
    const existing = findFormulaRow(rows, formula, t, m.code)
    const enabled = Boolean(enabledModes[m.code])
    if (!enabled && !existing) return
    const params = paramsForMode(m.code)
    out.push({
      ...(existing || {}),
      id: existing?.id || undefined,
      transportMode: m.code,
      rateCode: rateCodeFor(formula, m.code),
      custAcNo: t.custAcNo,
      origin: t.origin,
      destination: t.destination,
      serviceType: t.serviceType,
      pcsMin: 0,
      pcsMax: 999999,
      weightMin: 0,
      weightMax: MAX_WEIGHT,
      baseAmount: Number(params.baseAmount || 0),
      perPiece: Number(params.perPiece || 0),
      perKg: Number(params.perKg || 0),
      formulaType: formula.type,
      formulaJson: params.formulaJson || {},
      description: existing?.description || description(m),
      isActive: enabled,
      sortOrder: FORMULA_SORT_ORDER,
    })
    if (enabled) {
      activeRowsAt(rows, t, m.code)
        .filter((r) => !existing || r.id !== existing.id)
        .forEach((r) => out.push({ ...r, isActive: false }))
    }
  })
  return out
}

/** Merge changed rows into the full list (by id; new rows appended). */
export function mergeRows(rows, changed) {
  const byId = new Map(changed.filter((r) => r.id).map((r) => [r.id, r]))
  const merged = rows.map((r) => byId.get(r.id) || r)
  return [...merged, ...changed.filter((r) => !r.id)]
}

export function splitByScope(rows) {
  return {
    deliveryFeeRates: rows.filter((r) => !up(r.custAcNo)),
    customerDeliveryFeeRates: rows.filter((r) => up(r.custAcNo)),
  }
}

export function saveBody(changed, extra = {}) {
  const { deliveryFeeRates, customerDeliveryFeeRates } = splitByScope(changed)
  const body = { ...extra }
  if (deliveryFeeRates.length) body.deliveryFeeRates = deliveryFeeRates
  if (customerDeliveryFeeRates.length) body.customerDeliveryFeeRates = customerDeliveryFeeRates
  return body
}

export function targetFromSearch(search) {
  const q = new URLSearchParams(search)
  return normTarget({
    custAcNo: q.get('customer'),
    origin: q.get('origin'),
    destination: q.get('destination'),
    serviceType: q.get('service'),
  })
}

export function targetSearch(target, modeCode) {
  const t = normTarget(target)
  const q = new URLSearchParams()
  if (t.custAcNo) q.set('customer', t.custAcNo)
  if (t.origin) q.set('origin', t.origin)
  if (t.destination) q.set('destination', t.destination)
  if (t.serviceType) q.set('service', t.serviceType)
  if (modeCode) q.set('mode', modeCode)
  const s = q.toString()
  return s ? `?${s}` : ''
}
