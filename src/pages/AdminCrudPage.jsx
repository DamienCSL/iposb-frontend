import { useEffect, useMemo, useState } from 'react'
import { apiError, deleteMaster, geocodeBackfill, listMaster, saveMaster } from '../api/client'
import GeoLocationPicker from '../components/GeoLocationPicker'
import SearchableSelect from '../components/SearchableSelect'
import { Alert, SystemCodeField } from '../ui/bits'

const GEO_PAIRS = [
  { lat: 'lat', lng: 'lng', label: 'Pin location on map' },
  { lat: 'base_lat', lng: 'base_lng', label: 'Driver base / depot pin' },
]

function resolveGeoPair(fields) {
  const names = new Set((fields || []).map((f) => f.name))
  return GEO_PAIRS.find((p) => names.has(p.lat) && names.has(p.lng)) || null
}

function mapLookupOptions(kind, rows) {
  const list = Array.isArray(rows) ? rows : []
  switch (kind) {
    case 'hubs':
      return list
        .filter((r) => r.hub_code)
        .map((r) => ({
          value: String(r.hub_code),
          label: `${r.hub_code} — ${r.hub_name || r.hub_code}`,
          hub_code: r.hub_code,
        }))
    case 'delivery-points':
      return list
        .filter((r) => r.delivery_point_code || r.zone_code)
        .map((r) => {
          const code = String(r.delivery_point_code || r.zone_code)
          const name = r.delivery_point_name || r.zone_name || code
          return {
            value: code,
            label: `${code} — ${name}`,
            hub_code: r.hub_code || '',
            delivery_point_code: code,
          }
        })
    case 'areas':
      return list
        .filter((r) => r.area_code)
        .map((r) => ({
          value: String(r.area_code),
          label: `${r.area_code} — ${r.area_name || r.area_code}`,
          delivery_point_code: r.delivery_point_code || '',
          hub_code: r.hub_code || '',
        }))
    case 'branches':
      return list
        .filter((r) => r.branch_code)
        .map((r) => ({
          value: String(r.branch_code),
          label: `${r.branch_code} — ${r.branch_name || r.branch_code}`,
        }))
    case 'drop-points':
      return list
        .filter((r) => r.id != null)
        .map((r) => ({
          value: String(r.id),
          label: `${r.drop_code || r.id} — ${r.drop_name || ''}`,
          drop_code: r.drop_code,
          delivery_point_code: r.delivery_point_code || '',
          hub_code: r.hub_code || '',
        }))
    case 'route-codes':
      return list
        .filter((r) => r.route_cd)
        .map((r) => ({
          value: String(r.route_cd),
          label: `${r.route_cd} — ${r.route_name || r.route_cd}`,
          delivery_point_code: r.delivery_point_code || '',
        }))
    default:
      return []
  }
}

const SPECS = {
  users: {
    title: 'User Management',
    columns: [['username', 'Username'], ['name', 'Name'], ['branch_code', 'Branch'], ['app_role', 'Role'], ['is_active', 'Active']],
    fields: [
      { name: 'username', label: 'Username' },
      { name: 'name', label: 'Name' },
      { name: 'branch_code', label: 'Branch code', lookup: 'branches' },
      {
        name: 'app_role',
        label: 'Role',
        type: 'select',
        options: [
          ['Super Admin', 'Super Admin'],
          ['Admin', 'Admin'],
          ['Operation', 'Operation'],
          ['Invoice', 'Invoice'],
          ['Agent', 'Agent'],
          ['Hub Manager', 'Hub Manager'],
          ['Droppoint Manager', 'Droppoint Manager'],
          ['CSL', 'CSL'],
        ],
      },
      { name: 'user_password', label: 'Password', type: 'password' },
      {
        name: 'is_active',
        label: 'Active',
        type: 'select',
        options: [['1', 'Yes'], ['0', 'No']],
      },
    ],
    pk: 'id',
  },
  customers: {
    title: 'Customer Registration',
    columns: [
      ['cust_ac_no', 'Account'],
      ['cust_name', 'Name'],
      ['cust_tel', 'Phone'],
      ['cust_email', 'Email'],
      ['cust_state', 'State'],
      ['cust_status', 'Status'],
    ],
    fields: [
      { name: 'cust_ac_no', label: 'Account no', generate: 'cust_ac_no' },
      { name: 'cust_name', label: 'Customer name' },
      { name: 'cust_tel', label: 'Phone' },
      { name: 'cust_email', label: 'Email' },
      { name: 'cust_contact', label: 'Contact person' },
      { name: 'cust_addr1', label: 'Address line 1' },
      { name: 'cust_addr2', label: 'Address line 2' },
      { name: 'cust_state', label: 'State / city' },
      { name: 'cust_postcode', label: 'Postcode' },
      {
        name: 'cust_status',
        label: 'Status',
        type: 'select',
        options: [
          ['A', 'Active'],
          ['I', 'Inactive'],
        ],
      },
    ],
    pk: 'id',
  },
  branches: {
    title: 'Branch Management',
    columns: [['branch_code', 'Code'], ['branch_name', 'Name'], ['phone', 'Phone'], ['is_active', 'Active']],
    fields: [
      { name: 'branch_code', label: 'Branch code', generate: 'branch_code' },
      { name: 'branch_name', label: 'Name' },
      { name: 'phone', label: 'Phone' },
      { name: 'address_line1', label: 'Address' },
    ],
    pk: 'id',
  },
  hubs: {
    title: 'Hub Management',
    columns: [['hub_code', 'Code'], ['hub_name', 'Name'], ['hub_type', 'Type'], ['lat', 'Lat'], ['lng', 'Lng'], ['is_active', 'Active']],
    fields: [
      { name: 'hub_code', label: 'Hub code', generate: 'hub_code' },
      { name: 'hub_name', label: 'Name' },
      {
        name: 'hub_type',
        label: 'Hub type',
        type: 'select',
        options: [
          ['main', 'Main hub (KK — only one)'],
          ['mini', 'Mini hub (other city)'],
        ],
      },
      { name: 'parent_hub_code', label: 'Parent hub (optional)', lookup: 'hubs' },
      { name: 'address_line1', label: 'Address' },
      { name: 'lat', label: 'Latitude', type: 'number' },
      { name: 'lng', label: 'Longitude', type: 'number' },
    ],
    pk: 'id',
  },
  'drop-points': {
    title: 'Drop Point Management',
    columns: [['drop_code', 'Code'], ['drop_name', 'Name'], ['delivery_point_code', 'Delivery point'], ['hub_code', 'Hub'], ['lat', 'Lat'], ['lng', 'Lng'], ['is_active', 'Active']],
    fields: [
      { name: 'drop_code', label: 'Drop code', generate: 'drop_code' },
      { name: 'drop_name', label: 'Name' },
      { name: 'delivery_point_code', label: 'Delivery point', lookup: 'delivery-points' },
      { name: 'hub_code', label: 'Hub', lookup: 'hubs' },
      { name: 'drop_type', label: 'Type' },
      { name: 'address_line1', label: 'Address' },
      { name: 'lat', label: 'Latitude', type: 'number' },
      { name: 'lng', label: 'Longitude', type: 'number' },
    ],
    pk: 'id',
  },
  '3pl': {
    title: '3PL Partners',
    columns: [['partner_code', 'Code'], ['partner_name', 'Name'], ['phone', 'Phone'], ['is_active', 'Active']],
    fields: [
      { name: 'partner_code', label: 'Partner code', generate: 'partner_code' },
      { name: 'partner_name', label: 'Name' },
      { name: 'phone', label: 'Phone' },
    ],
    pk: 'id',
  },
  coverage: {
    title: 'Coverage Areas',
    columns: [['area_code', 'Code'], ['area_name', 'Name'], ['delivery_point_code', 'Delivery point'], ['owner_type', 'Owner']],
    fields: [
      { name: 'area_code', label: 'Area code', generate: 'coverage' },
      { name: 'area_name', label: 'Name' },
      { name: 'delivery_point_code', label: 'Delivery point', lookup: 'delivery-points' },
      { name: 'owner_type', label: 'Owner type' },
    ],
    pk: 'id',
  },
  dispatchers: {
    title: 'Dispatcher Management',
    columns: [
      ['dispatcher_code', 'Code'],
      ['full_name', 'Name'],
      ['area_code', 'Area'],
      ['delivery_point_code', 'Delivery point'],
      ['is_active', 'Active'],
    ],
    fields: [
      { name: 'dispatcher_code', label: 'Code', generate: 'dispatcher_code' },
      { name: 'full_name', label: 'Name' },
      { name: 'area_code', label: 'Assigned area', lookup: 'areas' },
      { name: 'delivery_point_code', label: 'Delivery point (from area)', lookup: 'delivery-points' },
      { name: 'phone', label: 'Phone' },
      { name: 'email', label: 'Email' },
    ],
    pk: 'id',
  },
  drivers: {
    title: 'Driver Management',
    columns: [['driver_id', 'ID'], ['full_name', 'Name'], ['loc_id', 'Loc'], ['route_cd', 'Route'], ['base_lat', 'Lat'], ['base_lng', 'Lng'], ['is_available', 'Available']],
    fields: [
      { name: 'firebase_uid', label: 'Firebase UID', generate: 'firebase_uid' },
      { name: 'full_name', label: 'Name' },
      { name: 'phone', label: 'Phone' },
      { name: 'loc_id', label: 'Location / hub', lookup: 'hubs' },
      { name: 'route_cd', label: 'Route code', lookup: 'route-codes' },
      { name: 'home_drop_point_id', label: 'Home drop point', lookup: 'drop-points' },
      { name: 'base_lat', label: 'Base latitude', type: 'number' },
      { name: 'base_lng', label: 'Base longitude', type: 'number' },
    ],
    pk: 'driver_id',
  },
  routes: {
    title: 'Route Table',
    columns: [['rule_code', 'Code'], ['origin_zone', 'Origin DP'], ['destination_zone', 'Dest DP'], ['priority', 'Priority'], ['is_active', 'Active']],
    fields: [
      { name: 'rule_code', label: 'Rule code', generate: 'rule_code' },
      { name: 'origin_zone', label: 'Origin delivery point', lookup: 'delivery-points' },
      { name: 'destination_zone', label: 'Destination delivery point', lookup: 'delivery-points' },
      { name: 'priority', label: 'Priority' },
    ],
    pk: 'id',
  },
  'delivery-points': {
    title: 'Delivery Point Management',
    columns: [['delivery_point_code', 'Code'], ['delivery_point_name', 'Name'], ['hub_code', 'Hub'], ['lat', 'Lat'], ['lng', 'Lng'], ['is_active', 'Active']],
    fields: [
      { name: 'delivery_point_code', label: 'Delivery point code', generate: 'delivery_point_code' },
      { name: 'delivery_point_name', label: 'Name' },
      { name: 'hub_code', label: 'Hub', lookup: 'hubs' },
      { name: 'address_line1', label: 'Address' },
      { name: 'lat', label: 'Latitude', type: 'number' },
      { name: 'lng', label: 'Longitude', type: 'number' },
    ],
    pk: 'id',
  },
  areas: {
    title: 'Area Management',
    columns: [
      ['area_code', 'Code'],
      ['area_name', 'Name'],
      ['delivery_point_code', 'Delivery point'],
      ['lat', 'Lat'],
      ['lng', 'Lng'],
      ['is_active', 'Active'],
    ],
    fields: [
      { name: 'area_code', label: 'Area code', generate: 'area_code' },
      { name: 'area_name', label: 'Name' },
      { name: 'delivery_point_code', label: 'Parent delivery point', lookup: 'delivery-points' },
      { name: 'match_keywords', label: 'Address match keywords (comma-separated)' },
      { name: 'address_line1', label: 'Area address / landmark' },
      { name: 'lat', label: 'Centroid latitude', type: 'number' },
      { name: 'lng', label: 'Centroid longitude', type: 'number' },
      { name: 'notes', label: 'Notes' },
    ],
    pk: 'id',
  },
  'route-codes': {
    title: 'Route Codes',
    columns: [['route_cd', 'Code'], ['route_name', 'Name'], ['delivery_point_code', 'Delivery point']],
    fields: [
      { name: 'route_cd', label: 'Route code', generate: 'route_cd' },
      { name: 'route_name', label: 'Name' },
      { name: 'delivery_point_code', label: 'Delivery point', lookup: 'delivery-points' },
    ],
    pk: 'id',
  },
}

export default function AdminCrudPage({ resource }) {
  const resolved = resource === 'zones' ? 'delivery-points' : resource
  const spec = SPECS[resolved]
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({})
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [lookups, setLookups] = useState({})

  const geoPair = useMemo(() => (spec ? resolveGeoPair(spec.fields) : null), [spec])
  const formFields = useMemo(() => {
    if (!spec) return []
    if (!geoPair) return spec.fields
    return spec.fields.filter((f) => f.name !== geoPair.lat && f.name !== geoPair.lng)
  }, [spec, geoPair])

  const neededLookups = useMemo(() => {
    if (!spec) return []
    return [...new Set(spec.fields.map((f) => f.lookup).filter(Boolean))]
  }, [spec])

  const lookupOptions = useMemo(() => {
    const out = {}
    for (const kind of neededLookups) {
      out[kind] = mapLookupOptions(kind, lookups[kind] || [])
    }
    return out
  }, [neededLookups, lookups])

  function reload() {
    listMaster(resolved).then((d) => setRows(d.rows || [])).catch((e) => setError(apiError(e)))
  }

  useEffect(() => {
    setForm({})
    setEditId(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved])

  useEffect(() => {
    if (neededLookups.length === 0) {
      setLookups({})
      return
    }
    let cancelled = false
    Promise.all(
      neededLookups.map(async (kind) => {
        try {
          const data = await listMaster(kind)
          return [kind, data.rows || []]
        } catch {
          return [kind, []]
        }
      }),
    ).then((pairs) => {
      if (cancelled) return
      const next = {}
      for (const [kind, rows] of pairs) next[kind] = rows
      setLookups(next)
    })
    return () => {
      cancelled = true
    }
  }, [neededLookups])

  function onLookupChange(field, value, option) {
    setForm((prev) => {
      const next = { ...prev, [field.name]: value }
      // Selecting an area fills its parent delivery point (and hub when blank).
      if (field.name === 'area_code' && option?.delivery_point_code) {
        next.delivery_point_code = option.delivery_point_code
        if (option.hub_code && !next.hub_code) next.hub_code = option.hub_code
      }
      // Selecting a delivery point can fill hub when the form has hub_code.
      if (field.name === 'delivery_point_code' && option?.hub_code && 'hub_code' in next) {
        next.hub_code = option.hub_code
      }
      if ((field.name === 'origin_zone' || field.name === 'destination_zone') && option?.hub_code) {
        // route table only stores zones; hub is informational via option
      }
      return next
    })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    try {
      const payload = { ...form }
      if (!payload.user_password) delete payload.user_password
      const r = await saveMaster(resolved, payload, editId)
      setOk(r.message)
      setForm({})
      setEditId(null)
      reload()
    } catch (err) {
      setError(apiError(err))
    }
  }

  async function onBackfillMissing() {
    if (!window.confirm(`Backfill missing coordinates for ${resolved} from address (up to 25)?`)) return
    setError('')
    setOk('')
    try {
      const data = await geocodeBackfill(resolved, 25)
      setOk(data.message || `Updated ${data.updated || 0}`)
      reload()
    } catch (err) {
      setError(apiError(err))
    }
  }

  if (!spec) return <div className="alert alert-danger">Unknown resource</div>

  const addressHint = String(form.address_line1 || form.address || form.cust_addr1 || '').trim()

  return (
    <div>
      <h3 className="mb-3">{spec.title}</h3>
      <Alert error={error} ok={ok} />
      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={onSubmit}>
            {formFields.map((f) => (
              <div className="col-md-3" key={f.name}>
                <label className="form-label">
                  {f.label}
                  {f.generate && !editId ? (
                    <span className="text-muted fw-normal small ms-1">— or generate</span>
                  ) : null}
                </label>
                {f.lookup ? (
                  <SearchableSelect
                    size="sm"
                    value={form[f.name] ?? ''}
                    options={lookupOptions[f.lookup] || []}
                    placeholder={`Search ${f.label.toLowerCase()}…`}
                    onChange={(value, option) => onLookupChange(f, value, option)}
                  />
                ) : f.type === 'select' ? (
                  <select
                    className="form-select form-select-sm"
                    value={form[f.name] ?? ''}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  >
                    <option value="">—</option>
                    {(f.options || []).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : f.generate && !editId ? (
                  <SystemCodeField
                    size="sm"
                    value={form[f.name] || ''}
                    kind={f.generate}
                    resource={resolved}
                    branchCode={f.useBranch ? form.branch_code : undefined}
                    onChange={(v) => setForm({ ...form, [f.name]: v })}
                    onError={setError}
                  />
                ) : (
                  <input
                    className="form-control form-control-sm"
                    type={f.type || 'text'}
                    step={f.type === 'number' ? 'any' : undefined}
                    value={form[f.name] ?? ''}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  />
                )}
              </div>
            ))}

            {geoPair ? (
              <div className="col-12 mt-2">
                <GeoLocationPicker
                  key={`${resolved}-${editId || 'new'}`}
                  label={geoPair.label}
                  lat={form[geoPair.lat]}
                  lng={form[geoPair.lng]}
                  addressHint={addressHint}
                  onChange={({ lat, lng, displayName }) => {
                    setForm((prev) => ({
                      ...prev,
                      [geoPair.lat]: lat ?? '',
                      [geoPair.lng]: lng ?? '',
                    }))
                    if (displayName) {
                      setOk(`Pinned: ${displayName}`)
                    }
                  }}
                  onError={setError}
                />
              </div>
            ) : null}

            <div className="col-12 d-flex flex-wrap gap-1 mt-2">
              <button className="btn btn-primary btn-sm" type="submit">
                {editId ? 'Update' : 'Create'}
              </button>
              {editId ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    setEditId(null)
                    setForm({})
                  }}
                >
                  Cancel
                </button>
              ) : null}
              {geoPair && ['hubs', 'drop-points', 'delivery-points', 'areas'].includes(resolved) ? (
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onBackfillMissing}>
                  Backfill missing from addresses
                </button>
              ) : null}
            </div>
          </form>
          {geoPair ? (
            <div className="form-text mt-2">
              Search a place or click the map to pin. Drag the pin to fine-tune. Saving with an address and no pin still
              auto-geocodes when possible.
            </div>
          ) : null}
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark">
            <tr>
              {spec.columns.map(([k, l]) => (
                <th key={k}>{l}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[spec.pk]}>
                {spec.columns.map(([k]) => (
                  <td key={k}>{String(r[k] ?? '')}</td>
                ))}
                <td className="text-nowrap">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setEditId(r[spec.pk])
                      setForm(r)
                    }}
                  >
                    Edit
                  </button>{' '}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={async () => {
                      if (!window.confirm('Delete this record?')) return
                      try {
                        await deleteMaster(resolved, r[spec.pk])
                        setOk('Deleted.')
                        reload()
                      } catch (err) {
                        setError(apiError(err))
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={spec.columns.length + 1} className="text-muted">
                  No records.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
