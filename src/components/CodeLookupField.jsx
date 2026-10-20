import { useCallback, useEffect, useMemo, useState } from 'react'
import { AutoComplete, Button, Input, Select, Space, Tooltip, Typography, message } from 'antd'
import { LinkOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { apiError, generateCode, listMaster } from '../api/client'

const { Text } = Typography

/** @type {Record<string, { resource: string, codeKeys: string[], nameKeys: string[], manageTo: string, generateKind: string, label: string }>} */
export const CODE_LOOKUP_KINDS = {
  hubs: {
    resource: 'hubs',
    codeKeys: ['hub_code', 'code'],
    nameKeys: ['hub_name', 'name'],
    manageTo: '/ops/admin/hubs',
    generateKind: 'hub_code',
    label: 'hub',
  },
  branches: {
    resource: 'branches',
    codeKeys: ['branch_code', 'code'],
    nameKeys: ['branch_name', 'name'],
    manageTo: '/ops/admin/branches',
    generateKind: 'branch_code',
    label: 'branch',
  },
  'delivery-points': {
    resource: 'zones',
    codeKeys: ['delivery_point_code', 'zone_code', 'code'],
    nameKeys: ['delivery_point_name', 'zone_name', 'name'],
    manageTo: '/ops/admin/zones',
    generateKind: 'delivery_point_code',
    label: 'delivery point',
  },
  zones: {
    resource: 'zones',
    codeKeys: ['delivery_point_code', 'zone_code', 'code'],
    nameKeys: ['delivery_point_name', 'zone_name', 'name'],
    manageTo: '/ops/admin/zones',
    generateKind: 'delivery_point_code',
    label: 'delivery point',
  },
  'drop-points': {
    resource: 'drop-points',
    codeKeys: ['drop_code', 'code'],
    nameKeys: ['drop_name', 'name'],
    manageTo: '/ops/admin/drop-points',
    generateKind: 'drop_code',
    label: 'drop point',
  },
  areas: {
    resource: 'areas',
    codeKeys: ['area_code', 'code'],
    nameKeys: ['area_name', 'name'],
    manageTo: '/ops/admin/areas',
    generateKind: 'area_code',
    label: 'area',
  },
  'route-codes': {
    // Legacy alias — route codes removed; look up network areas instead.
    resource: 'areas',
    codeKeys: ['area_code', 'route_cd', 'code'],
    nameKeys: ['area_name', 'name'],
    manageTo: '/ops/admin/areas',
    generateKind: 'area_code',
    label: 'network area',
  },
  customers: {
    resource: 'customers',
    codeKeys: ['cust_ac_no', 'code'],
    nameKeys: ['cust_name', 'name'],
    manageTo: '/ops/admin/customers',
    generateKind: 'cust_ac_no',
    label: 'customer',
  },
  dispatchers: {
    resource: 'dispatchers',
    codeKeys: ['dispatcher_code', 'code'],
    nameKeys: ['full_name', 'name'],
    manageTo: '/ops/admin/dispatchers',
    generateKind: 'dispatcher_code',
    label: 'dispatcher',
  },
  '3pl': {
    resource: '3pl',
    codeKeys: ['partner_code', 'code'],
    nameKeys: ['partner_name', 'name'],
    manageTo: '/ops/admin/3pl',
    generateKind: 'partner_code',
    label: '3PL partner',
  },
}

const GENERATE_KIND_META = {
  hub_code: CODE_LOOKUP_KINDS.hubs,
  branch_code: CODE_LOOKUP_KINDS.branches,
  drop_code: CODE_LOOKUP_KINDS['drop-points'],
  delivery_point_code: CODE_LOOKUP_KINDS['delivery-points'],
  area_code: CODE_LOOKUP_KINDS.areas,
  coverage: CODE_LOOKUP_KINDS.areas,
  route_cd: CODE_LOOKUP_KINDS.areas,
  dispatcher_code: CODE_LOOKUP_KINDS.dispatchers,
  partner_code: CODE_LOOKUP_KINDS['3pl'],
  cust_ac_no: CODE_LOOKUP_KINDS.customers,
  agent_cd: CODE_LOOKUP_KINDS['drop-points'],
  rule_code: { resource: 'routes', codeKeys: ['rule_code'], nameKeys: ['rule_code'], manageTo: '/ops/admin/routes', generateKind: 'rule_code', label: 'routing rule' },
}

function pickField(row, keys) {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function normalizeOptions(rows, meta, valueAsId = false) {
  const seen = new Set()
  const out = []
  for (const row of rows || []) {
    const code = pickField(row, meta.codeKeys)
    if (!code) continue
    const value = valueAsId && row?.id != null && String(row.id).trim() !== ''
      ? String(row.id).trim()
      : code
    const dedupeKey = valueAsId ? value : code.toUpperCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    const name = pickField(row, meta.nameKeys)
    out.push({
      value,
      label: name && name !== code ? `${code} — ${name}` : code,
      name,
      code,
    })
  }
  return out.sort((a, b) => String(a.label).localeCompare(String(b.label)))
}

function parseMultiValue(value, forceUpper) {
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        let s = String(v ?? '').trim()
        if (forceUpper) s = s.toUpperCase()
        return s
      })
      .filter(Boolean)
  }
  const raw = value == null ? '' : String(value).trim()
  if (!raw) return []
  return raw
    .split(/[,;\s]+/)
    .map((p) => {
      let s = p.trim()
      if (forceUpper) s = s.toUpperCase()
      return s
    })
    .filter(Boolean)
}

/**
 * Searchable master-code picker with optional Generate + Manage link.
 * Supports single select, AutoComplete (allowCustom), or multi/tags (mode="multiple"|"tags").
 */
export default function CodeLookupField({
  kind = null,
  generateKind = null,
  value,
  onChange,
  placeholder,
  size = 'middle',
  disabled = false,
  allowClear = true,
  allowCustom = false,
  showGenerate = false,
  showManageLink = true,
  branchCode,
  uppercase = true,
  valueAsId = false,
  mode = null,
  style,
}) {
  const meta = (kind && CODE_LOOKUP_KINDS[kind])
    || (generateKind && GENERATE_KIND_META[generateKind])
    || null
  const resolvedGenerateKind = generateKind || meta?.generateKind || null
  const canSearch = Boolean(kind && CODE_LOOKUP_KINDS[kind])
  const forceUpper = uppercase && !valueAsId
  const isMulti = mode === 'multiple' || mode === 'tags'

  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!canSearch || !meta) {
      setOptions([])
      return
    }
    setLoading(true)
    try {
      const res = await listMaster(meta.resource)
      setOptions(normalizeOptions(res?.rows || res?.data || [], meta, valueAsId))
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [canSearch, meta, valueAsId])

  useEffect(() => {
    load()
  }, [load])

  const multiValues = useMemo(
    () => (isMulti ? parseMultiValue(value, forceUpper) : []),
    [isMulti, value, forceUpper],
  )

  const mergedOptions = useMemo(() => {
    if (isMulti) {
      const extras = []
      for (const v of multiValues) {
        if (!options.some((o) => String(o.value).toUpperCase() === String(v).toUpperCase())) {
          extras.push({ value: v, label: `${v} (current)`, name: '' })
        }
      }
      return extras.length ? [...extras, ...options] : options
    }
    const v = value != null && String(value).trim() !== '' ? String(value).trim() : ''
    if (!v) return options
    if (options.some((o) => String(o.value).toUpperCase() === v.toUpperCase())) return options
    return [{ value: v, label: `${v} (current)`, name: '' }, ...options]
  }, [options, value, isMulti, multiValues])

  function emit(next) {
    if (isMulti) {
      const list = parseMultiValue(next, forceUpper)
      onChange?.(list.join(','))
      return
    }
    let v = next == null ? '' : String(next)
    if (forceUpper) v = v.toUpperCase()
    onChange?.(v)
  }

  async function onGenerate() {
    if (busy || disabled || !resolvedGenerateKind) return
    setBusy(true)
    try {
      const r = await generateCode(resolvedGenerateKind, {
        branchCode: branchCode || undefined,
        resource: meta?.resource,
      })
      if (isMulti) {
        const next = [...multiValues, forceUpper ? String(r.code || '').toUpperCase() : String(r.code || '')]
          .filter(Boolean)
        emit(next)
      } else {
        emit(r.code || '')
      }
      message.success(`Generated code ${r.code}`)
      if (canSearch) load()
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const filterOption = (input, option) => {
    const hay = `${option?.value || ''} ${option?.label || ''} ${option?.code || ''} ${option?.name || ''}`.toLowerCase()
    return hay.includes(String(input || '').toLowerCase())
  }

  const controlStyle = { width: '100%', ...(style || {}) }
  const ph = placeholder || (meta ? `Search ${meta.label}…` : 'Enter code…')

  let control
  if (canSearch && isMulti) {
    control = (
      <Select
        mode={allowCustom || mode === 'tags' ? 'tags' : 'multiple'}
        size={size}
        style={controlStyle}
        disabled={disabled}
        allowClear={allowClear}
        showSearch
        loading={loading}
        options={mergedOptions}
        value={multiValues}
        placeholder={ph}
        optionFilterProp="label"
        filterOption={filterOption}
        tokenSeparators={[',', ';', ' ']}
        onChange={(vals) => emit(vals || [])}
        notFoundContent={loading ? 'Loading…' : 'No matches — type to add'}
        maxTagCount="responsive"
      />
    )
  } else if (canSearch && allowCustom) {
    control = (
      <AutoComplete
        size={size}
        style={controlStyle}
        disabled={disabled}
        allowClear={allowClear}
        options={mergedOptions}
        value={value ?? ''}
        placeholder={ph}
        filterOption={filterOption}
        onChange={(v) => emit(v)}
        notFoundContent={loading ? 'Loading…' : 'No matches — type a code or create one'}
      />
    )
  } else if (canSearch) {
    control = (
      <Select
        size={size}
        style={controlStyle}
        disabled={disabled}
        allowClear={allowClear}
        showSearch
        loading={loading}
        options={mergedOptions}
        value={value || undefined}
        placeholder={ph}
        optionFilterProp="label"
        filterOption={filterOption}
        onChange={(v) => emit(v ?? '')}
        notFoundContent={loading ? 'Loading…' : 'No matches'}
      />
    )
  } else {
    control = (
      <Input
        size={size}
        style={controlStyle}
        disabled={disabled}
        allowClear={allowClear}
        value={value ?? ''}
        placeholder={ph}
        onChange={(e) => emit(e.target.value)}
      />
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <Space.Compact style={{ width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>{control}</div>
        {showGenerate && resolvedGenerateKind ? (
          <Tooltip title={`Generate ${meta?.label || 'system'} code`}>
            <Button
              size={size}
              icon={<ThunderboltOutlined />}
              loading={busy}
              disabled={disabled}
              onClick={onGenerate}
            >
              Gen
            </Button>
          </Tooltip>
        ) : null}
      </Space.Compact>
      {showManageLink && meta?.manageTo ? (
        <div style={{ marginTop: 4 }}>
          <Link to={meta.manageTo} style={{ fontSize: 12 }}>
            <LinkOutlined /> Manage {meta.label}s
          </Link>
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
            create / edit in master data
          </Text>
        </div>
      ) : null}
    </div>
  )
}
