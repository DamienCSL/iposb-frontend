import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  BarcodeOutlined,
  BranchesOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GlobalOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import {
  apiError,
  deleteMaster,
  geocodeBackfill,
  listMaster,
  rotateApiKey,
  saveMaster,
} from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import GeoLocationPicker from '../../components/GeoLocationPicker'
import CodeLookupField from '../../components/CodeLookupField'
import ListPageLayout from '../../components/ListPageLayout'
import StatusTag from '../../components/StatusTag'

const GEO_PAIRS = {
  hubs: { lat: 'lat', lng: 'lng', label: 'Pin hub location on map' },
  'drop-points': { lat: 'lat', lng: 'lng', label: 'Pin drop point on map' },
  zones: { lat: 'lat', lng: 'lng', label: 'Pin delivery point on map' },
  areas: { lat: 'lat', lng: 'lng', label: 'Pin area centroid on map' },
  drivers: { lat: 'base_lat', lng: 'base_lng', label: 'Driver base / depot pin' },
}

const GEO_BACKFILL_RESOURCES = ['hubs', 'drop-points', 'zones', 'areas']

const { Title, Text, Paragraph } = Typography

/**
 * Mask phone numbers with asterisks for security / privacy (e.g. 012-***-4567 or +60 12-***-7890).
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return phone || '—'
  const trimmed = phone.trim()
  if (trimmed.length <= 4) return '***'
  const len = trimmed.length
  // Keep first 3-4 chars and last 2-3 chars, mask the center
  const prefixLen = len > 8 ? 4 : 3
  const suffixLen = len > 8 ? 3 : 2
  const prefix = trimmed.slice(0, prefixLen)
  const suffix = trimmed.slice(len - suffixLen)
  return `${prefix}***${suffix}`
}

/**
 * Interactive masked phone component with optional reveal toggle for authorized staff (Admin / PIC).
 */
export function MaskedPhone({ phone, canReveal = false }) {
  const [revealed, setRevealed] = useState(false)

  if (!phone || phone === '—') {
    return <span style={{ color: '#9CA3AF' }}>—</span>
  }

  const masked = maskPhoneNumber(phone)

  return (
    <Space size={4} align="center">
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          letterSpacing: '0.02em',
          color: '#1F2937',
        }}
      >
        {revealed ? phone : masked}
      </span>
      {canReveal && (
        <Tooltip title={revealed ? 'Hide phone number' : 'Reveal phone number (Authorized PIC / Admin)'}>
          <Button
            type="text"
            size="small"
            icon={
              revealed ? (
                <EyeInvisibleOutlined style={{ fontSize: 12, color: '#6B7280' }} />
              ) : (
                <EyeOutlined style={{ fontSize: 12, color: '#1B8A5A' }} />
              )
            }
            onClick={(e) => {
              e.stopPropagation()
              setRevealed((v) => !v)
            }}
            style={{ padding: '0 2px', height: 20, width: 20, minWidth: 20 }}
          />
        </Tooltip>
      )}
    </Space>
  )
}

/**
 * Categorized Master Data Registry:
 * Groups 13 master tables into 4 intuitive operational domains.
 */
export const MASTER_CATEGORIES = [
  {
    key: 'facilities',
    title: 'Facilities & Network',
    icon: <ShopOutlined />,
    description: 'Physical station branches, transit hub gateways, counter drop points, and geo-service zones.',
    resources: [
      { key: 'branches', label: 'Branches', icon: <ShopOutlined /> },
      { key: 'hubs', label: 'Hubs & Transit', icon: <DeploymentUnitOutlined /> },
      { key: 'drop-points', label: 'Drop Points', icon: <EnvironmentOutlined /> },
      { key: 'coverage', label: 'Coverage Areas', icon: <GlobalOutlined /> },
    ],
  },
  {
    key: 'fleet',
    title: 'Fleet & Dispatch',
    icon: <CarOutlined />,
    description: 'First/last-mile couriers, station dispatchers, and external third-party partner carriers.',
    resources: [
      { key: 'drivers', label: 'Drivers & Couriers', icon: <CarOutlined /> },
      { key: 'dispatchers', label: 'Dispatchers', icon: <ApartmentOutlined /> },
      { key: '3pl', label: '3PL Partners', icon: <ClusterOutlined /> },
    ],
  },
  {
    key: 'routing',
    title: 'Routing & Zones',
    icon: <BranchesOutlined />,
    description: 'Delivery zones, dispatch routing codes, and automated cross-zone linehaul rules.',
    resources: [
      { key: 'zones', label: 'Delivery Points', icon: <EnvironmentOutlined /> },
      { key: 'areas', label: 'Network Areas', icon: <GlobalOutlined /> },
      { key: 'route-codes', label: 'Route Codes', icon: <BarcodeOutlined /> },
      { key: 'routes', label: 'Routing Matrix', icon: <BranchesOutlined /> },
    ],
  },
  {
    key: 'accounts',
    title: 'Accounts & Access',
    icon: <TeamOutlined />,
    description: 'Corporate shipper accounts, reseller commission agents, and back-office staff credentials.',
    resources: [
      { key: 'customers', label: 'Corporate Customers', icon: <TeamOutlined /> },
      { key: 'agents', label: 'Reseller Agents', icon: <UsergroupAddOutlined /> },
      { key: 'users', label: 'Staff Users', icon: <SafetyCertificateOutlined /> },
    ],
  },
]

export const MASTER_SCHEMAS = {
  branches: {
    title: 'Branch Management',
    singular: 'Branch',
    category: 'facilities',
    icon: <ShopOutlined />,
    columns: [
      { title: 'Code', dataIndex: 'branch_code', key: 'branch_code', render: (v) => <Tag color="blue">{v}</Tag> },
      { title: 'Name', dataIndex: 'branch_name', key: 'branch_name', render: (v) => <strong>{v}</strong> },
      { title: 'Phone', dataIndex: 'phone', key: 'phone' },
      { title: 'Address', dataIndex: 'address_line1', key: 'address_line1' },
      { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (v) => <StatusTag status={v === '0' ? 'INACTIVE' : 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'branch_code', label: 'Branch Code', required: true, placeholder: 'e.g. BKI', generate: 'branch_code' },
      { name: 'branch_name', label: 'Branch Name', required: true, placeholder: 'e.g. Kota Kinabalu' },
      { name: 'phone', label: 'Phone Number', placeholder: '+60 88 123456' },
      { name: 'address_line1', label: 'Address', type: 'textarea' },
    ],
    pk: 'id',
  },
  hubs: {
    title: 'Hub Management',
    singular: 'Hub',
    category: 'facilities',
    icon: <DeploymentUnitOutlined />,
    columns: [
      { title: 'Hub Code', dataIndex: 'hub_code', key: 'hub_code', render: (v) => <Tag color="cyan">{v}</Tag> },
      { title: 'Hub Name', dataIndex: 'hub_name', key: 'hub_name', render: (v) => <strong>{v}</strong> },
      { title: 'Branch', dataIndex: 'branch_code', key: 'branch_code' },
      { title: 'Type', dataIndex: 'hub_type', key: 'hub_type', render: (v, r) => v || r.hub_level || '—' },
      { title: 'Lat', dataIndex: 'lat', key: 'lat', width: 90, render: (v) => (v != null && v !== '' ? Number(v).toFixed(4) : '—') },
      { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (v) => <StatusTag status={v === '0' ? 'INACTIVE' : 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'hub_code', label: 'Hub Code', required: true, placeholder: 'e.g. BKI-HUB', generate: 'hub_code', useBranch: true },
      { name: 'hub_name', label: 'Hub Name', required: true, placeholder: 'e.g. Central Gateway Hub' },
      { name: 'branch_code', label: 'Branch Code', required: true, lookup: 'branches' },
      {
        name: 'hub_type',
        label: 'Hub Type',
        type: 'select',
        options: [
          { label: 'Main hub (KK — only one)', value: 'main' },
          { label: 'Mini hub (other city)', value: 'mini' },
        ],
      },
      { name: 'hub_level', label: 'Level', placeholder: 'GATEWAY or TRANSIT' },
      { name: 'parent_hub_code', label: 'Parent Hub (Optional)', lookup: 'hubs' },
      { name: 'address_line1', label: 'Address', type: 'textarea', placeholder: 'Used for map search / auto-geocode' },
      { name: 'lat', label: 'Latitude', type: 'number', geo: true },
      { name: 'lng', label: 'Longitude', type: 'number', geo: true },
    ],
    pk: 'id',
  },
  'drop-points': {
    title: 'Drop Point Management',
    singular: 'Drop Point',
    category: 'facilities',
    icon: <EnvironmentOutlined />,
    columns: [
      { title: 'Drop Code', dataIndex: 'drop_code', key: 'drop_code', render: (v) => <Tag color="geekblue">{v}</Tag> },
      { title: 'Name', dataIndex: 'drop_name', key: 'drop_name', render: (v) => <strong>{v}</strong> },
      { title: 'Delivery Point', dataIndex: 'delivery_point_code', key: 'delivery_point_code' },
      { title: 'Hub', dataIndex: 'hub_code', key: 'hub_code' },
      { title: 'Type', dataIndex: 'drop_type', key: 'drop_type' },
      { title: 'Lat', dataIndex: 'lat', key: 'lat', width: 90, render: (v) => (v != null && v !== '' ? Number(v).toFixed(4) : '—') },
      { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (v) => <StatusTag status={v === '0' ? 'INACTIVE' : 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'drop_code', label: 'Drop Point Code', required: true, generate: 'drop_code', useBranch: true },
      { name: 'drop_name', label: 'Drop Point Name', required: true },
      { name: 'delivery_point_code', label: 'Delivery Point Code', required: true, placeholder: 'e.g. DPT-KUL', lookup: 'delivery-points' },
      { name: 'hub_code', label: 'Hub Code', required: true, lookup: 'hubs' },
      { name: 'branch_code', label: 'Branch Code', lookup: 'branches' },
      { name: 'drop_type', label: 'Type', placeholder: 'STATION, PARTNER, or LOCKER' },
      { name: 'address_line1', label: 'Address', type: 'textarea', placeholder: 'Used for map search / auto-geocode' },
      { name: 'lat', label: 'Latitude', type: 'number', geo: true },
      { name: 'lng', label: 'Longitude', type: 'number', geo: true },
    ],
    pk: 'id',
  },
  coverage: {
    title: 'Coverage Areas',
    singular: 'Coverage Area',
    category: 'facilities',
    icon: <GlobalOutlined />,
    columns: [
      { title: 'Area Code', dataIndex: 'area_code', key: 'area_code', render: (v) => <Tag color="geekblue">{v}</Tag> },
      { title: 'Area Name', dataIndex: 'area_name', key: 'area_name', render: (v) => <strong>{v}</strong> },
      { title: 'Delivery Point', dataIndex: 'delivery_point_code', key: 'delivery_point_code', render: (v, r) => <Tag color="green">{v || r.zone_code || '—'}</Tag> },
      {
        title: 'Owner Type',
        dataIndex: 'owner_type',
        key: 'owner_type',
        render: (v) => <Tag color={v === 'internal' || v === 'own' ? 'blue' : 'orange'}>{v || 'uncovered'}</Tag>,
      },
    ],
    fields: [
      { name: 'area_code', label: 'Area Code', required: true, placeholder: 'e.g. KK-CBD', generate: 'coverage' },
      { name: 'area_name', label: 'Area Name', required: true, placeholder: 'e.g. Kota Kinabalu CBD' },
      { name: 'delivery_point_code', label: 'Delivery Point Code', required: true, placeholder: 'e.g. DPT-KUL', lookup: 'delivery-points' },
      {
        name: 'owner_type',
        label: 'Owner Type',
        type: 'select',
        options: [
          { label: 'Own / Internal', value: 'own' },
          { label: '3PL Partner', value: '3pl' },
          { label: 'Uncovered (HQ)', value: 'uncovered' },
          { label: 'Drop Point', value: 'drop_point' },
        ],
      },
    ],
    pk: 'id',
  },
  drivers: {
    title: 'Driver Management',
    singular: 'Driver',
    category: 'fleet',
    icon: <CarOutlined />,
    columns: [
      { title: 'Driver ID', dataIndex: 'driver_id', key: 'driver_id', render: (v) => <Tag>{v}</Tag> },
      { title: 'Full Name', dataIndex: 'full_name', key: 'full_name', render: (v) => <strong>{v}</strong> },
      { title: 'Phone', dataIndex: 'phone', key: 'phone' },
      { title: 'Route Code', dataIndex: 'route_cd', key: 'route_cd' },
      {
        title: 'Status',
        dataIndex: 'is_available',
        key: 'is_available',
        render: (v) => <StatusTag status={v ? 'ACTIVE' : 'INACTIVE'} text={v ? 'Available' : 'Busy'} />,
      },
    ],
    fields: [
      { name: 'full_name', label: 'Full Name', required: true },
      { name: 'phone', label: 'Phone', required: true },
      { name: 'loc_id', label: 'Branch / Location / Hub', required: true, placeholder: 'e.g. BKI', lookup: 'hubs', allowCustom: true },
      { name: 'route_cd', label: 'Assigned Route Code', lookup: 'route-codes' },
      { name: 'home_drop_point_id', label: 'Home Drop Point ID' },
      { name: 'preferred_zones', label: 'Preferred Zones', placeholder: 'e.g. BKI, BKI-NORTH' },
      { name: 'mobile_email', label: 'Mobile Login Email', required: true, placeholder: 'driver@example.com' },
      { name: 'mobile_password', label: 'Mobile Login Password', type: 'password', required: true },
      { name: 'base_lat', label: 'Base latitude', type: 'number', geo: true },
      { name: 'base_lng', label: 'Base longitude', type: 'number', geo: true },
    ],
    pk: 'driver_id',
  },
  dispatchers: {
    title: 'Dispatcher Management',
    singular: 'Dispatcher',
    category: 'fleet',
    icon: <ApartmentOutlined />,
    columns: [
      { title: 'Code', dataIndex: 'dispatcher_code', key: 'dispatcher_code', render: (v) => <Tag>{v}</Tag> },
      { title: 'Name', dataIndex: 'full_name', key: 'full_name', render: (v) => <strong>{v}</strong> },
      { title: 'Phone', dataIndex: 'phone', key: 'phone' },
      { title: 'Area', dataIndex: 'area_code', key: 'area_code' },
      { title: 'Delivery Point', dataIndex: 'delivery_point_code', key: 'delivery_point_code', render: (v, r) => v || r.zone_code || '—' },
      { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (v) => <StatusTag status={v === '0' ? 'INACTIVE' : 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'dispatcher_code', label: 'Dispatcher Code', required: true, generate: 'dispatcher_code', useBranch: true },
      { name: 'full_name', label: 'Full Name', required: true },
      { name: 'area_code', label: 'Assigned Area Code', lookup: 'areas' },
      { name: 'delivery_point_code', label: 'Delivery Point Code', lookup: 'delivery-points' },
      { name: 'branch_code', label: 'Branch Code', lookup: 'branches' },
      { name: 'zone_code', label: 'Zone Code (legacy)', lookup: 'delivery-points', allowCustom: true },
      { name: 'phone', label: 'Phone' },
      { name: 'email', label: 'Email' },
    ],
    pk: 'id',
  },
  '3pl': {
    title: '3PL Partners',
    singular: '3PL Partner',
    category: 'fleet',
    icon: <ClusterOutlined />,
    columns: [
      { title: 'Partner Code', dataIndex: 'partner_code', key: 'partner_code', render: (v) => <Tag color="purple">{v}</Tag> },
      { title: 'Partner Name', dataIndex: 'partner_name', key: 'partner_name', render: (v) => <strong>{v}</strong> },
      { title: 'Contact Phone', dataIndex: 'phone', key: 'phone' },
      { title: 'API Integration', dataIndex: 'has_api_key', key: 'has_api_key', render: () => <Tag color="green">Active</Tag> },
    ],
    fields: [
      { name: 'partner_code', label: 'Partner Code', required: true, placeholder: 'e.g. JNT, DHL', generate: 'partner_code' },
      { name: 'partner_name', label: 'Partner Name', required: true },
      { name: 'phone', label: 'Phone' },
      { name: 'contact_person', label: 'Contact Person' },
    ],
    pk: 'id',
  },
  zones: {
    title: 'Delivery Points (Zones)',
    singular: 'Delivery Point',
    category: 'routing',
    icon: <EnvironmentOutlined />,
    columns: [
      { title: 'Code', dataIndex: 'delivery_point_code', key: 'delivery_point_code', render: (v, r) => <Tag color="green">{v || r.zone_code}</Tag> },
      { title: 'Name', dataIndex: 'delivery_point_name', key: 'delivery_point_name', render: (v, r) => <strong>{v || r.zone_name}</strong> },
      { title: 'Hub', dataIndex: 'hub_code', key: 'hub_code' },
      { title: 'Branch', dataIndex: 'branch_code', key: 'branch_code' },
      { title: 'Lat', dataIndex: 'lat', key: 'lat', width: 90, render: (v) => (v != null && v !== '' ? Number(v).toFixed(4) : '—') },
      { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (v) => <StatusTag status={v === '0' ? 'INACTIVE' : 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'delivery_point_code', label: 'Delivery Point Code', required: true, generate: 'delivery_point_code', useBranch: true },
      { name: 'delivery_point_name', label: 'Name', required: true },
      { name: 'hub_code', label: 'Hub Code', required: true, lookup: 'hubs' },
      { name: 'branch_code', label: 'Branch Code', lookup: 'branches' },
      { name: 'address_line1', label: 'Address', type: 'textarea', placeholder: 'Used for map search / auto-geocode' },
      { name: 'lat', label: 'Latitude', type: 'number', geo: true },
      { name: 'lng', label: 'Longitude', type: 'number', geo: true },
    ],
    pk: 'id',
  },
  areas: {
    title: 'Network Areas',
    singular: 'Area',
    category: 'routing',
    icon: <GlobalOutlined />,
    columns: [
      { title: 'Area Code', dataIndex: 'area_code', key: 'area_code', render: (v) => <Tag color="geekblue">{v}</Tag> },
      { title: 'Area Name', dataIndex: 'area_name', key: 'area_name', render: (v) => <strong>{v}</strong> },
      { title: 'Delivery Point', dataIndex: 'delivery_point_code', key: 'delivery_point_code' },
      { title: 'Hub', dataIndex: 'hub_code', key: 'hub_code' },
      { title: 'Lat', dataIndex: 'lat', key: 'lat', width: 90, render: (v) => (v != null && v !== '' ? Number(v).toFixed(4) : '—') },
      { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (v) => <StatusTag status={v === '0' ? 'INACTIVE' : 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'area_code', label: 'Area Code', required: true, generate: 'area_code', useBranch: true },
      { name: 'area_name', label: 'Area Name', required: true },
      { name: 'delivery_point_code', label: 'Parent Delivery Point', required: true, lookup: 'delivery-points' },
      { name: 'hub_code', label: 'Hub Code', lookup: 'hubs' },
      { name: 'branch_code', label: 'Branch Code', lookup: 'branches' },
      {
        name: 'match_keywords',
        label: 'Address Match Keywords',
        type: 'textarea',
        placeholder: 'Comma-separated keywords for last-mile address matching',
      },
      { name: 'address_line1', label: 'Area Address / Landmark', type: 'textarea' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      { name: 'lat', label: 'Centroid latitude', type: 'number', geo: true },
      { name: 'lng', label: 'Centroid longitude', type: 'number', geo: true },
    ],
    pk: 'id',
  },
  'route-codes': {
    title: 'Route Codes',
    singular: 'Route Code',
    category: 'routing',
    icon: <BarcodeOutlined />,
    columns: [
      { title: 'Route Code', dataIndex: 'route_cd', key: 'route_cd', render: (v) => <Tag color="gold">{v}</Tag> },
      { title: 'Name', dataIndex: 'route_name', key: 'route_name', render: (v) => <strong>{v}</strong> },
      { title: 'Delivery Point', dataIndex: 'delivery_point_code', key: 'delivery_point_code', render: (v, r) => v || r.zone_code || '—' },
      { title: 'Branch', dataIndex: 'branch_code', key: 'branch_code' },
    ],
    fields: [
      { name: 'route_cd', label: 'Route Code', required: true, generate: 'route_cd', useBranch: true },
      { name: 'route_name', label: 'Route Name', required: true },
      { name: 'delivery_point_code', label: 'Delivery Point Code', lookup: 'delivery-points' },
      { name: 'branch_code', label: 'Branch Code', lookup: 'branches' },
      { name: 'zone_code', label: 'Zone Code (legacy)', lookup: 'delivery-points', allowCustom: true },
    ],
    pk: 'id',
  },
  routes: {
    title: 'Routing Matrix Rules',
    singular: 'Routing Rule',
    category: 'routing',
    icon: <BranchesOutlined />,
    columns: [
      { title: 'Rule Code', dataIndex: 'rule_code', key: 'rule_code', render: (v) => <Tag color="blue">{v}</Tag> },
      { title: 'Origin Zone', dataIndex: 'origin_zone', key: 'origin_zone' },
      { title: 'Dest Zone', dataIndex: 'destination_zone', key: 'destination_zone' },
      { title: 'Priority', dataIndex: 'priority', key: 'priority' },
      { title: 'Status', dataIndex: 'is_active', key: 'is_active', render: (v) => <StatusTag status={v === '0' ? 'INACTIVE' : 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'rule_code', label: 'Rule Code', required: true, generate: 'rule_code' },
      { name: 'origin_zone', label: 'Origin Delivery Point', required: true, lookup: 'delivery-points' },
      { name: 'destination_zone', label: 'Destination Delivery Point', required: true, lookup: 'delivery-points' },
      { name: 'priority', label: 'Priority', type: 'number' },
    ],
    pk: 'id',
  },
  customers: {
    title: 'Customer Directory',
    singular: 'Customer',
    category: 'accounts',
    icon: <TeamOutlined />,
    columns: [
      { title: 'Account #', dataIndex: 'cust_ac_no', key: 'cust_ac_no', render: (v) => <Tag color="blue">{v}</Tag> },
      { title: 'Company / Name', dataIndex: 'cust_name', key: 'cust_name', render: (v) => <strong>{v}</strong> },
      { title: 'Phone', dataIndex: 'cust_tel', key: 'cust_tel', render: (v, r) => v || r.phone || '—' },
      { title: 'Email', dataIndex: 'cust_email', key: 'cust_email' },
      { title: 'Branch', dataIndex: 'branch_code', key: 'branch_code' },
    ],
    fields: [
      { name: 'cust_ac_no', label: 'Account Number', required: true, generate: 'cust_ac_no' },
      { name: 'cust_name', label: 'Customer Name', required: true },
      { name: 'cust_tel', label: 'Phone' },
      { name: 'cust_email', label: 'Email' },
      { name: 'cust_addr1', label: 'Address line 1', type: 'textarea' },
      { name: 'cust_postcode', label: 'Postcode' },
      { name: 'cust_state', label: 'State / City' },
      { name: 'branch_code', label: 'Branch Code', lookup: 'branches' },
    ],
    pk: 'id',
  },
  agents: {
    title: 'Agent Directory',
    singular: 'Agent',
    category: 'accounts',
    icon: <UsergroupAddOutlined />,
    columns: [
      { title: 'Agent Code', dataIndex: 'agent_cd', key: 'agent_cd', render: (v) => <Tag color="cyan">{v}</Tag> },
      { title: 'Agent Name', dataIndex: 'agent_name', key: 'agent_name', render: (v) => <strong>{v}</strong> },
      { title: 'Phone', dataIndex: 'phone', key: 'phone' },
      { title: 'Branch', dataIndex: 'branch_code', key: 'branch_code' },
      { title: 'Commission %', dataIndex: 'commission_rate', key: 'commission_rate', render: (v) => `${v || 5}%` },
    ],
    fields: [
      { name: 'agent_cd', label: 'Agent Code', required: true, generate: 'agent_cd' },
      { name: 'agent_name', label: 'Agent Name', required: true },
      { name: 'phone', label: 'Phone' },
      { name: 'branch_code', label: 'Branch Code', lookup: 'branches' },
      { name: 'commission_rate', label: 'Commission Rate (%)', type: 'number' },
    ],
    pk: 'id',
  },
  users: {
    title: 'Staff Users',
    singular: 'User',
    category: 'accounts',
    icon: <SafetyCertificateOutlined />,
    columns: [
      { title: 'Username', dataIndex: 'username', key: 'username', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
      { title: 'Full Name', dataIndex: 'name', key: 'name' },
      { title: 'Role', dataIndex: 'app_role', key: 'app_role', render: (v) => <Tag color="blue">{v}</Tag> },
      { title: 'Branch', dataIndex: 'branch_code', key: 'branch_code' },
      { title: 'Active', dataIndex: 'is_active', key: 'is_active', render: (v) => <StatusTag status={v === '0' ? 'INACTIVE' : 'ACTIVE'} /> },
    ],
    fields: [
      { name: 'username', label: 'Username', required: true },
      { name: 'name', label: 'Full Name', required: true },
      { name: 'branch_code', label: 'Branch Code', lookup: 'branches' },
      {
        name: 'app_role',
        label: 'Role',
        required: true,
        type: 'select',
        options: [
          { label: 'Super Admin', value: 'Super Admin' },
          { label: 'Admin', value: 'Admin' },
          { label: 'Hub Manager', value: 'Hub Manager' },
          { label: 'Droppoint Manager', value: 'Droppoint Manager' },
          { label: 'Operation', value: 'Operation' },
          { label: 'Agent', value: 'Agent' },
          { label: 'Invoice (Billing)', value: 'Invoice' },
          { label: 'CSL (Customer Service)', value: 'CSL' },
          { label: 'Others (limited)', value: 'Others' },
        ],
      },
      { name: 'user_password', label: 'Password', type: 'password', placeholder: 'Leave blank to keep current' },
    ],
    pk: 'id',
  },
}

export default function MasterAdminPage() {
  const { resource: pathResource } = useParams()
  const navigate = useNavigate()
  const { can, isAdmin, user } = useAuth()

  // Authorized edit access: Only Admin and Station PICs (Hub Manager, Droppoint Manager, Operation)
  const isPic = useMemo(() => {
    const role = (user?.role || '').toLowerCase()
    return (
      ['super admin', 'admin', 'hub manager', 'droppoint manager', 'operation'].includes(role) ||
      role.includes('manager') ||
      role.includes('pic')
    )
  }, [user?.role])

  const canManageMaster = Boolean(isAdmin || isPic || can('admin'))

  const currentResource = pathResource || 'branches'
  const schema = MASTER_SCHEMAS[currentResource] || MASTER_SCHEMAS.branches
  const geoPair = GEO_PAIRS[currentResource] || null
  const formFields = useMemo(
    () => (schema.fields || []).filter((f) => !f.geo),
    [schema],
  )

  // Find active category
  const activeCategory = useMemo(() => {
    return (
      MASTER_CATEGORIES.find((cat) => cat.resources.some((r) => r.key === currentResource)) ||
      MASTER_CATEGORIES[0]
    )
  }, [currentResource])

  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [form] = Form.useForm()
  const watchedLat = Form.useWatch(geoPair?.lat, form)
  const watchedLng = Form.useWatch(geoPair?.lng, form)
  const watchedBranchCode = Form.useWatch('branch_code', form)
  const addressHint = Form.useWatch('address_line1', form) || ''

  // API Key Rotation State (Strictly required for 3PL)
  const [rotateModal, setRotateModal] = useState({ open: false, partner: null })
  const [rotating, setRotating] = useState(false)

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const term = search.toLowerCase().trim()
    return rows.filter((r) =>
      Object.values(r).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(term))
    )
  }, [rows, search])

  // Count active entities
  const activeCount = useMemo(() => {
    return rows.filter((r) => r.is_active !== '0' && r.is_available !== false).length
  }, [rows])

  async function loadData() {
    setLoading(true)
    try {
      const res = await listMaster(currentResource)
      setRows(res?.data || res?.rows || (Array.isArray(res) ? res : []))
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSearch('')
    loadData()
  }, [currentResource])

  function openCreate() {
    if (!canManageMaster) {
      message.warning('Access Restricted: Master data creation is restricted to Admin and Station PICs.')
      return
    }
    setEditingItem(null)
    form.resetFields()
    setDrawerOpen(true)
  }

  function openEdit(record) {
    if (!canManageMaster) {
      message.warning('Access Restricted: Master data editing is restricted to Admin and Station PICs.')
      return
    }
    setEditingItem(record)
    form.resetFields()
    form.setFieldsValue(record)
    setDrawerOpen(true)
  }

  async function handleSubmit(values) {
    if (!canManageMaster) {
      message.error('Unauthorized: You do not have permission to modify master data.')
      return
    }
    setSaving(true)
    try {
      const pkField = schema.pk || 'id'
      const id = editingItem ? editingItem[pkField] || editingItem.id : null
      await saveMaster(currentResource, values, id)
      message.success(`${schema.singular} saved successfully`)
      setDrawerOpen(false)
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!canManageMaster) {
      message.error('Unauthorized: You do not have permission to delete master records.')
      return
    }
    try {
      await deleteMaster(currentResource, id)
      message.success(`${schema.singular} removed`)
      loadData()
    } catch (err) {
      message.error(apiError(err))
    }
  }

  async function handleGeocodeBackfill() {
    if (!canManageMaster) {
      message.warning('Access Restricted: Geocode backfill is restricted to Admin and Station PICs.')
      return
    }
    const apiResource = currentResource === 'zones' ? 'delivery-points' : currentResource
    Modal.confirm({
      title: 'Backfill missing coordinates?',
      content: `Geocode up to 25 ${schema.title.toLowerCase()} records that have an address but no lat/lng.`,
      okText: 'Backfill',
      onOk: async () => {
        setBackfilling(true)
        try {
          const data = await geocodeBackfill(apiResource, 25)
          message.success(data?.message || `Updated ${data?.updated || 0} record(s)`)
          loadData()
        } catch (err) {
          message.error(apiError(err))
        } finally {
          setBackfilling(false)
        }
      },
    })
  }

  // Partner API Key Rotate handler
  async function confirmKeyRotation() {
    const code = rotateModal.partner?.partner_code || rotateModal.partner?.code
    if (!code) return
    setRotating(true)
    try {
      const res = await rotateApiKey(code)
      message.success(`API key rotated for partner ${code}. New key: ${res?.new_api_key || 'Generated'}`)
      setRotateModal({ open: false, partner: null })
      loadData()
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setRotating(false)
    }
  }

  // Build columns dynamically with masked phone numbers and RBAC Actions
  const columns = useMemo(() => {
    const baseCols = (schema.columns || []).map((col) => {
      // Check if this column is a phone number column
      const keyOrTitle = (col.key || col.dataIndex || col.title || '').toLowerCase()
      if (keyOrTitle.includes('phone') || keyOrTitle.includes('tel') || keyOrTitle.includes('mobile')) {
        return {
          ...col,
          render: (val) => <MaskedPhone phone={val} canReveal={canManageMaster} />,
        }
      }
      return col
    })

    return [
      ...baseCols,
      {
        title: 'Actions',
        key: 'actions',
        align: 'right',
        width: canManageMaster ? 160 : 110,
        render: (_, r) => {
          if (!canManageMaster) {
            return (
              <Tooltip title="View Only — Modification is restricted to System Administrators and Station PICs">
                <Tag
                  icon={<LockOutlined />}
                  style={{
                    borderRadius: 4,
                    color: '#6B7280',
                    background: '#F3F4F6',
                    borderColor: '#E5E7EB',
                    cursor: 'not-allowed',
                  }}
                >
                  Read Only
                </Tag>
              </Tooltip>
            )
          }

          const pkField = schema.pk || 'id'
          const id = r[pkField] || r.id

          return (
            <Space size="small">
              {currentResource === '3pl' && isAdmin && (
                <Tooltip title="Rotate & invalidate 3PL partner integration API credentials">
                  <Button
                    size="small"
                    icon={<KeyOutlined />}
                    onClick={() => setRotateModal({ open: true, partner: r })}
                  >
                    Key
                  </Button>
                </Tooltip>
              )}
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                Edit
              </Button>
              <Popconfirm
                title={`Delete this ${schema.singular.toLowerCase()}?`}
                description="This will permanently delete this master record."
                onConfirm={() => handleDelete(id)}
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          )
        },
      },
    ]
  }, [schema, canManageMaster, currentResource, isAdmin])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Security & Access Banner if Read-Only */}
      {!canManageMaster && (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined style={{ color: '#D97706' }} />}
          message="Master Data Governed: Read-Only Access Mode"
          description="You are currently browsing the Master Data Registry in read-only mode. Direct modifications, creation, or deletions are restricted to System Administrators and Station Persons-in-Charge (PIC)."
          style={{ borderRadius: 8, border: '1px solid #FDE68A', background: '#FFFBEB' }}
        />
      )}

      {currentResource === 'users' ? (
        <Alert
          type="info"
          showIcon
          message="Staff users & role access"
          description={
            <span>
              Assign each person a job role here (Super Admin, Operation, Invoice, …). Module menus and login landing pages are configured on{' '}
              <a href="/ops/admin/role-access">Role Access (RBAC)</a>. Seller / Receiver / Customer are not staff login roles.
            </span>
          }
        />
      ) : null}

      {/* Top Header Card with Domain Categories */}
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          border: '1px solid #E5E7EB',
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Space align="center" size={10}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#E8F5E9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1B8A5A',
                  fontSize: 20,
                }}
              >
                <SettingOutlined />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#111827' }}>
                  Master Data & System Registry
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Operational parameters, physical infrastructure, dispatch fleet, and governance accounts.
                </Text>
              </div>
            </Space>
          </div>

          <div>
            {canManageMaster ? (
              <Tag
                icon={<SafetyCertificateOutlined style={{ color: '#1B8A5A' }} />}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#E8F5E9',
                  borderColor: '#A3D9A5',
                  color: '#1B8A5A',
                }}
              >
                Admin & PIC Access: Full Management
              </Tag>
            ) : (
              <Tag
                icon={<LockOutlined style={{ color: '#D97706' }} />}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#FFFBEB',
                  borderColor: '#FDE68A',
                  color: '#D97706',
                }}
              >
                Auditor Access: Read-Only Mode
              </Tag>
            )}
          </div>
        </div>

        {/* 4 Primary Operational Domains Grid */}
        <div style={{ marginTop: 20 }}>
          <Row gutter={[12, 12]}>
            {MASTER_CATEGORIES.map((cat) => {
              const isSelectedCategory = activeCategory.key === cat.key
              return (
                <Col xs={24} sm={12} lg={6} key={cat.key}>
                  <div
                    onClick={() => {
                      if (!isSelectedCategory) {
                        navigate(`/ops/admin/${cat.resources[0].key}`)
                      }
                    }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: isSelectedCategory ? '2px solid #1B8A5A' : '1px solid #E5E7EB',
                      background: isSelectedCategory ? '#F4FBF7' : '#FAFAFA',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Space size={8} align="center">
                        <span style={{ fontSize: 16, color: isSelectedCategory ? '#1B8A5A' : '#6B7280' }}>
                          {cat.icon}
                        </span>
                        <strong style={{ fontSize: 14, color: isSelectedCategory ? '#1B8A5A' : '#1F2937' }}>
                          {cat.title}
                        </strong>
                      </Space>
                      {isSelectedCategory && (
                        <CheckCircleOutlined style={{ color: '#1B8A5A', fontSize: 14 }} />
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1.4 }}>
                      {cat.description}
                    </Text>
                  </div>
                </Col>
              )
            })}
          </Row>
        </div>

        {/* Active Domain Sub-Resource Pill Selector */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px dashed #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeCategory.title}:
            </span>
            {activeCategory.resources.map((res) => {
              const isActive = currentResource === res.key
              return (
                <Button
                  key={res.key}
                  type={isActive ? 'primary' : 'default'}
                  icon={res.icon}
                  size="middle"
                  onClick={() => navigate(`/ops/admin/${res.key}`)}
                  style={{
                    borderRadius: 20,
                    fontWeight: isActive ? 600 : 500,
                    background: isActive ? '#1B8A5A' : '#FFFFFF',
                    borderColor: isActive ? '#1B8A5A' : '#D1D5DB',
                    color: isActive ? '#FFFFFF' : '#374151',
                    boxShadow: isActive ? '0 2px 4px rgba(27,138,90,0.25)' : 'none',
                  }}
                >
                  {res.label}
                  {isActive && rows.length > 0 && (
                    <Badge
                      count={rows.length}
                      overflowCount={999}
                      style={{
                        marginLeft: 6,
                        backgroundColor: '#0E623E',
                        color: '#FFFFFF',
                        boxShadow: 'none',
                      }}
                    />
                  )}
                </Button>
              )
            })}
          </div>

          <Space size={8}>
            <Tooltip title="Refresh live database records">
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                Refresh
              </Button>
            </Tooltip>
            {canManageMaster && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ background: '#1B8A5A', borderColor: '#1B8A5A', fontWeight: 600 }}
                onClick={openCreate}
              >
                New {schema.singular}
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* KPI Metrics Strip */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #E5E7EB' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#6B7280' }}>Total {schema.title}</span>}
              value={rows.length}
              valueStyle={{ fontWeight: 700, fontSize: 22, color: '#111827' }}
              prefix={schema.icon || <AppstoreOutlined style={{ color: '#1B8A5A' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #E5E7EB' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#6B7280' }}>Active & Ready</span>}
              value={activeCount}
              valueStyle={{ fontWeight: 700, fontSize: 22, color: '#1B8A5A' }}
              prefix={<CheckCircleOutlined style={{ color: '#1B8A5A' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #E5E7EB' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#6B7280' }}>Privacy & Masking</span>}
              value="Enforced"
              valueStyle={{ fontWeight: 700, fontSize: 18, color: '#2563EB' }}
              prefix={<EyeInvisibleOutlined style={{ color: '#2563EB' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #E5E7EB' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#6B7280' }}>Governance Access</span>}
              value={canManageMaster ? 'Admin / PIC' : 'Read Only'}
              valueStyle={{ fontWeight: 700, fontSize: 18, color: canManageMaster ? '#059669' : '#D97706' }}
              prefix={canManageMaster ? <SafetyCertificateOutlined /> : <LockOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Layout */}
      <ListPageLayout
        title={`${schema.title}`}
        subtitle={`System registry and configuration parameters for ${schema.title.toLowerCase()}. Phone numbers masked by default for privacy.`}
        searchPlaceholder={`Search ${schema.title.toLowerCase()} across all fields...`}
        searchValue={search}
        onSearchChange={setSearch}
        actions={[
          {
            key: 'reload',
            label: 'Refresh',
            icon: <ReloadOutlined />,
            onClick: loadData,
          },
          ...(canManageMaster && GEO_BACKFILL_RESOURCES.includes(currentResource)
            ? [
                {
                  key: 'backfill',
                  label: 'Backfill coordinates',
                  icon: <EnvironmentOutlined />,
                  loading: backfilling,
                  onClick: handleGeocodeBackfill,
                },
              ]
            : []),
        ]}
        onNewClick={canManageMaster ? openCreate : undefined}
        newButtonText={canManageMaster ? `New ${schema.singular}` : undefined}
        columns={columns}
        dataSource={filteredRows}
        loading={loading}
        rowKey={schema.pk || 'id'}
        pagination={{ pageSize: 15 }}
        emptyText={`No ${schema.title.toLowerCase()} records found`}
      />

      {/* Dynamic Create/Edit Drawer */}
      <Drawer
        title={
          <Space>
            {editingItem ? <EditOutlined style={{ color: '#1B8A5A' }} /> : <PlusOutlined style={{ color: '#1B8A5A' }} />}
            <span>{editingItem ? `Edit ${schema.singular}` : `Create New ${schema.singular}`}</span>
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={geoPair ? 640 : 460}
        destroyOnClose
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canManageMaster && (
              <Button
                type="primary"
                loading={saving}
                onClick={() => form.submit()}
                style={{ background: '#1B8A5A', borderColor: '#1B8A5A', fontWeight: 600 }}
              >
                Save {schema.singular}
              </Button>
            )}
          </div>
        }
      >
        {!canManageMaster && (
          <Alert
            type="warning"
            showIcon
            message="Read-Only Mode"
            description="You do not have administrative or PIC permission to update this record."
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={!canManageMaster}>
          {formFields.map((f) => (
            <Form.Item
              key={f.name}
              label={f.label}
              name={f.name}
              rules={f.required ? [{ required: true, message: `${f.label} is required` }] : []}
              extra={
                f.generate && !editingItem
                  ? 'Search existing or click Gen to create a system code'
                  : f.lookup
                    ? 'Search from master data — or open Manage to create one'
                    : undefined
              }
            >
              {f.type === 'textarea' ? (
                <Input.TextArea rows={3} placeholder={f.placeholder} />
              ) : f.type === 'select' ? (
                <Select placeholder={f.placeholder} options={f.options} />
              ) : f.lookup || f.generate ? (
                <CodeLookupField
                  kind={f.lookup || null}
                  generateKind={f.generate || null}
                  allowCustom={Boolean(f.allowCustom || (!f.lookup && f.generate))}
                  allowClear={!f.required}
                  showGenerate={Boolean(f.generate)}
                  showManageLink={Boolean(f.lookup || f.generate)}
                  branchCode={f.useBranch ? watchedBranchCode : undefined}
                  placeholder={f.placeholder || `Search ${f.label.toLowerCase()}…`}
                />
              ) : f.type === 'password' ? (
                <Input.Password placeholder={f.placeholder} />
              ) : f.type === 'number' ? (
                <Input type="number" step="any" placeholder={f.placeholder} />
              ) : (
                <Input placeholder={f.placeholder} />
              )}
            </Form.Item>
          ))}

          {geoPair ? (
            <>
              <Form.Item name={geoPair.lat} hidden>
                <Input />
              </Form.Item>
              <Form.Item name={geoPair.lng} hidden>
                <Input />
              </Form.Item>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>{geoPair.label}</Text>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Search a place or click the map to pin. Drag to fine-tune. Saving with an address and no pin still auto-geocodes when possible.
                </div>
              </div>
              <GeoLocationPicker
                key={`${currentResource}-${editingItem?.[schema.pk] || 'new'}`}
                label={geoPair.label}
                lat={watchedLat}
                lng={watchedLng}
                addressHint={String(addressHint || '').trim()}
                height={280}
                onChange={({ lat, lng }) => {
                  form.setFieldsValue({
                    [geoPair.lat]: lat ?? '',
                    [geoPair.lng]: lng ?? '',
                  })
                }}
                onError={(msg) => message.error(msg)}
              />
            </>
          ) : null}
        </Form>
      </Drawer>

      {/* Destructive Partner API Key Rotation Confirmation Modal (PRD 6.14) */}
      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#D4380D' }} />
            <span>Rotate Partner API Key</span>
          </Space>
        }
        open={rotateModal.open}
        onCancel={() => setRotateModal({ open: false, partner: null })}
        footer={[
          <Button key="back" onClick={() => setRotateModal({ open: false, partner: null })}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={rotating}
            onClick={confirmKeyRotation}
          >
            Rotate & Invalidate Immediately
          </Button>,
        ]}
      >
        <Alert
          type="error"
          showIcon
          message="Destructive Action Warning"
          description={`Rotating the API key for ${rotateModal.partner?.partner_name} (${rotateModal.partner?.partner_code}) will immediately invalidate their currently active production integration credentials. Third-party automated booking webhooks will fail until the partner configures the new key.`}
          style={{ marginBottom: 16 }}
        />
        <Paragraph style={{ fontSize: 13, color: '#4B5563' }}>
          Are you sure you want to proceed with key rotation for{' '}
          <strong>{rotateModal.partner?.partner_name}</strong>?
        </Paragraph>
      </Modal>
    </div>
  )
}
