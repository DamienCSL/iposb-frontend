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
    resource: 'route-codes',
    codeKeys: ['route_cd', 'route_code', 'code'],
    nameKeys: ['route_name', 'name'],
    manageTo: '/ops/admin/route-codes',
    generateKind: 'route_cd',
    label: 'route code',
  },
  customers: {
    resource: 'customers',
    codeKeys: ['cust_ac_no', 'code'],
    nameKeys: ['cust_name', 'name'],
    manageTo: '/ops/admin/customers',
    generateKind: 'cust_ac_no',
    label: 'customer',
  },
  agents: {
    resource: 'agents',
    codeKeys: ['agent_cd', 'code'],
    nameKeys: ['agent_name', 'name'],
    manageTo: '/ops/admin/agents',
    generateKind: 'agent_cd',
    label: 'agent',
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
  route_cd: CODE_LOOKUP_KINDS['route-codes'],
  dispatcher_code: CODE_LOOKUP_KINDS.dispatchers,
  partner_code: CODE_LOOKUP_KINDS['3pl'],
  cust_ac_no: CODE_LOOKUP_KINDS.customers,
  agent_cd: CODE_LOOKUP_KINDS.agents,
  rule_code: { resource: 'routes', codeKeys: ['rule_code'], nameKeys: ['rule_code'], manageTo: '/ops/admin/routes', generateKind: 'rule_code', label: 'routing rule' },
}

function pickField(row, keys) {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function normalizeOptions(rows, meta) {
  const seen = new Set()
  const out = []
  for (const row of rows || []) {
    const code = pickField(row, meta.codeKeys)
    if (!code || seen.has(code.toUpperCase())) continue
    seen.add(code.toUpperCase())
    const name = pickField(row, meta.nameKeys)
    out.push({
      value: code,
      label: name && name !== code ? `${code} — ${name}` : code,
      name,
    })
  }
  return out.sort((a, b) => a.value.localeCompare(b.value))
}

/**
 * Searchable master-code picker with optional Generate + Manage link.
 *
 * @param {{
 *   kind?: keyof typeof CODE_LOOKUP_KINDS | string | null,
 *   generateKind?: string | null,
 *   value?: string | null,
 *   onChange?: (value: string) => void,
 *   placeholder?: string,
 *   size?: 'small' | 'middle' | 'large',
 *   disabled?: boolean,
 *   allowClear?: boolean,
 *   allowCustom?: boolean,
 *   showGenerate?: boolean,
 *   showManageLink?: boolean,
 *   branchCode?: string,
 *   uppercase?: boolean,
 *   style?: object,
 * }} props
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
  style,
}) {
  const meta = (kind && CODE_LOOKUP_KINDS[kind])
    || (generateKind && GENERATE_KIND_META[generateKind])
    || null
  const resolvedGenerateKind = generateKind || meta?.generateKind || null
  const canSearch = Boolean(kind && CODE_LOOKUP_KINDS[kind])

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
      setOptions(normalizeOptions(res?.rows || res?.data || [], meta))
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [canSearch, meta])

  useEffect(() => {
    load()
  }, [load])

  const mergedOptions = useMemo(() => {
    const v = value != null && String(value).trim() !== '' ? String(value).trim() : ''
    if (!v) return options
    if (options.some((o) => o.value.toUpperCase() === v.toUpperCase())) return options
    return [{ value: v, label: `${v} (current)`, name: '' }, ...options]
  }, [options, value])

  function emit(next) {
    let v = next == null ? '' : String(next)
    if (uppercase) v = v.toUpperCase()
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
      emit(r.code || '')
      message.success(`Generated code ${r.code}`)
      if (canSearch) load()
    } catch (e) {
      message.error(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const filterOption = (input, option) => {
    const hay = `${option?.value || ''} ${option?.label || ''}`.toLowerCase()
    return hay.includes(String(input || '').toLowerCase())
  }

  const controlStyle = { width: '100%', ...(style || {}) }
  const ph = placeholder || (meta ? `Search ${meta.label}…` : 'Enter code…')

  let control
  if (canSearch && allowCustom) {
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
