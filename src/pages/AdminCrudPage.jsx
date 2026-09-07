import { useEffect, useState } from 'react'
import { apiError, deleteMaster, listMaster, saveMaster } from '../api/client'
import { Alert, SystemCodeField } from '../ui/bits'

const SPECS = {
  users: {
    title: 'User Management',
    columns: [['username', 'Username'], ['name', 'Name'], ['branch_code', 'Branch'], ['app_role', 'Role'], ['is_active', 'Active']],
    fields: [
      { name: 'username', label: 'Username' },
      { name: 'name', label: 'Name' },
      { name: 'branch_code', label: 'Branch code' },
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
    columns: [['hub_code', 'Code'], ['hub_name', 'Name'], ['hub_type', 'Type'], ['is_active', 'Active']],
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
      { name: 'parent_hub_code', label: 'Parent hub (optional)' },
    ],
    pk: 'id',
  },
  'drop-points': {
    title: 'Drop Point Management',
    columns: [['drop_code', 'Code'], ['drop_name', 'Name'], ['delivery_point_code', 'Delivery point'], ['hub_code', 'Hub'], ['drop_type', 'Type'], ['is_active', 'Active']],
    fields: [
      { name: 'drop_code', label: 'Drop code', generate: 'drop_code' },
      { name: 'drop_name', label: 'Name' },
      { name: 'delivery_point_code', label: 'Delivery point code' },
      { name: 'hub_code', label: 'Hub code' },
      { name: 'drop_type', label: 'Type' },
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
      { name: 'area_code', label: 'Area code', generate: 'area_code' },
      { name: 'area_name', label: 'Name' },
      { name: 'delivery_point_code', label: 'Delivery point code' },
      { name: 'owner_type', label: 'Owner type' },
    ],
    pk: 'id',
  },
  dispatchers: {
    title: 'Dispatcher Management',
    columns: [['dispatcher_code', 'Code'], ['full_name', 'Name'], ['delivery_point_code', 'Delivery point'], ['is_active', 'Active']],
    fields: [
      { name: 'dispatcher_code', label: 'Code', generate: 'dispatcher_code' },
      { name: 'full_name', label: 'Name' },
      { name: 'delivery_point_code', label: 'Delivery point code' },
      { name: 'phone', label: 'Phone' },
      { name: 'email', label: 'Email' },
    ],
    pk: 'id',
  },
  drivers: {
    title: 'Driver Management',
    columns: [['driver_id', 'ID'], ['full_name', 'Name'], ['loc_id', 'Loc'], ['route_cd', 'Route'], ['is_available', 'Available']],
    fields: [
      { name: 'firebase_uid', label: 'Firebase UID', generate: 'firebase_uid' },
      { name: 'full_name', label: 'Name' },
      { name: 'phone', label: 'Phone' },
      { name: 'loc_id', label: 'Location / hub' },
      { name: 'route_cd', label: 'Route code' },
    ],
    pk: 'driver_id',
  },
  routes: {
    title: 'Route Table',
    columns: [['rule_code', 'Code'], ['origin_zone', 'Origin DP'], ['destination_zone', 'Dest DP'], ['priority', 'Priority'], ['is_active', 'Active']],
    fields: [
      { name: 'rule_code', label: 'Rule code', generate: 'rule_code' },
      { name: 'origin_zone', label: 'Origin delivery point' },
      { name: 'destination_zone', label: 'Destination delivery point' },
      { name: 'priority', label: 'Priority' },
    ],
    pk: 'id',
  },
  'delivery-points': {
    title: 'Delivery Point Management',
    columns: [['delivery_point_code', 'Code'], ['delivery_point_name', 'Name'], ['hub_code', 'Hub'], ['is_active', 'Active']],
    fields: [
      { name: 'delivery_point_code', label: 'Delivery point code', generate: 'delivery_point_code' },
      { name: 'delivery_point_name', label: 'Name' },
      { name: 'hub_code', label: 'Hub code' },
    ],
    pk: 'id',
  },
  'route-codes': {
    title: 'Route Codes',
    columns: [['route_cd', 'Code'], ['route_name', 'Name'], ['delivery_point_code', 'Delivery point']],
    fields: [
      { name: 'route_cd', label: 'Route code', generate: 'route_cd' },
      { name: 'route_name', label: 'Name' },
      { name: 'delivery_point_code', label: 'Delivery point code' },
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

  function reload() {
    listMaster(resolved).then((d) => setRows(d.rows || [])).catch((e) => setError(apiError(e)))
  }

  useEffect(() => {
    setForm({})
    setEditId(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved])

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

  if (!spec) return <div className="alert alert-danger">Unknown resource</div>

  return (
    <div>
      <h3 className="mb-3">{spec.title}</h3>
      <Alert error={error} ok={ok} />
      <div className="card mb-3"><div className="card-body">
        <form className="row g-2 align-items-end" onSubmit={onSubmit}>
          {spec.fields.map((f) => (
            <div className="col-md-3" key={f.name}>
              <label className="form-label">
                {f.label}
                {f.generate && !editId ? (
                  <span className="text-muted fw-normal small ms-1">— or generate</span>
                ) : null}
              </label>
              {f.type === 'select' ? (
                <select className="form-select form-select-sm" value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                  <option value="">—</option>
                  {(f.options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
                <input className="form-control form-control-sm" type={f.type || 'text'} value={form[f.name] || ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="col-md-2">
            <button className="btn btn-primary btn-sm" type="submit">{editId ? 'Update' : 'Create'}</button>
            {editId ? <button type="button" className="btn btn-outline-secondary btn-sm ms-1" onClick={() => { setEditId(null); setForm({}) }}>Cancel</button> : null}
          </div>
        </form>
      </div></div>
      <div className="table-responsive">
        <table className="table table-sm table-striped table-bordered">
          <thead className="table-dark"><tr>{spec.columns.map(([k, l]) => <th key={k}>{l}</th>)}<th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[spec.pk]}>
                {spec.columns.map(([k]) => <td key={k}>{String(r[k] ?? '')}</td>)}
                <td className="text-nowrap">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => { setEditId(r[spec.pk]); setForm(r) }}>Edit</button>{' '}
                  <button className="btn btn-sm btn-outline-danger" onClick={async () => {
                    if (!window.confirm('Delete this record?')) return
                    try {
                      await deleteMaster(resolved, r[spec.pk])
                      setOk('Deleted.')
                      reload()
                    } catch (err) {
                      setError(apiError(err))
                    }
                  }}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={spec.columns.length + 1} className="text-muted">No records.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
