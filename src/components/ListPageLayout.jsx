import React, { useState } from 'react'
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Radio,
  Select,
  Skeleton,
  Space,
} from 'antd'
import DataTable from './DataTable'
import {
  ColumnHeightOutlined,
  DownOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'

export default function ListPageLayout({
  title,
  subtitle,
  searchPlaceholder = 'Search records…',
  searchValue = '',
  onSearchChange,
  filters = [], // Array of { key, placeholder, options, value, onChange, width }
  actions = [], // Array of { key, label, icon, onClick, type: 'primary' | 'default' }
  moreActions = [], // Array of items for secondary Dropdown
  columns = [],
  dataSource = [],
  loading = false,
  rowKey = 'id',
  pagination = {},
  selectedRowKeys = [],
  onSelectionChange,
  extraHeader,
  emptyText = 'No records found',
  emptyDescription = 'Get started by creating a new entry.',
  onNewClick,
  newButtonText = '+ New',
}) {
  const [tableSize, setTableSize] = useState('small')

  const densityMenu = {
    items: [
      { key: 'default', label: 'Default' },
      { key: 'middle', label: 'Middle' },
      { key: 'small', label: 'Compact' },
    ],
    onClick: ({ key }) => setTableSize(key),
  }

  const rowSelection = onSelectionChange
    ? {
        selectedRowKeys,
        onChange: onSelectionChange,
      }
    : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: '#0F1B2D',
              letterSpacing: '-0.3px',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <div style={{ fontSize: 12, color: '#5B6B7C', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>

        <Space wrap>
          {actions.map((act) => (
            <Button
              key={act.key}
              type={act.type || 'default'}
              icon={act.icon}
              onClick={act.onClick}
              loading={act.loading}
            >
              {act.label}
            </Button>
          ))}

          {onNewClick && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onNewClick}
              style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
            >
              {newButtonText}
            </Button>
          )}

          {moreActions.length > 0 && (
            <Dropdown menu={{ items: moreActions }} placement="bottomRight">
              <Button icon={<EllipsisOutlined />} />
            </Dropdown>
          )}
        </Space>
      </div>

      {extraHeader}

      {/* Filter / Search Bar */}
      <Card
        size="small"
        bodyStyle={{ padding: '10px 14px' }}
        style={{ borderRadius: 6, borderColor: '#E5E7EB' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <Space wrap size="middle">
            {onSearchChange && (
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
                style={{ width: 260 }}
                allowClear
              />
            )}

            {filters.map((f) => (
              <Select
                key={f.key}
                placeholder={f.placeholder}
                value={f.value || undefined}
                onChange={f.onChange}
                options={f.options}
                style={{ minWidth: f.width || 140 }}
                allowClear
              />
            ))}
          </Space>

          <Space size="small">
            <Dropdown menu={densityMenu} placement="bottomRight">
              <Button
                size="small"
                icon={<ColumnHeightOutlined />}
                title="Density"
              />
            </Dropdown>
          </Space>
        </div>
      </Card>

      {/* Table Container */}
      {loading && dataSource.length === 0 ? (
        <div style={{ padding: 24, background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB' }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : (
        <DataTable
          size={tableSize}
          columns={columns}
          dataSource={dataSource}
          rowKey={rowKey}
          loading={loading}
          rowSelection={rowSelection}
          pagination={
            pagination === false
              ? false
              : {
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '25', '50', '100'],
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} of ${total} records`,
                  size: 'small',
                  style: { padding: '8px 16px', margin: 0 },
                  ...pagination,
                }
          }
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ padding: '12px 0' }}>
                    <div style={{ fontWeight: 500, color: '#374151' }}>
                      {emptyText}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                      {emptyDescription}
                    </div>
                    {onNewClick && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={onNewClick}
                        style={{
                          marginTop: 12,
                          background: '#1B8A5A',
                          borderColor: '#1B8A5A',
                        }}
                      >
                        {newButtonText}
                      </Button>
                    )}
                  </div>
                }
              />
            ),
          }}
          scroll={{ x: 'max-content' }}
        />
      )}
    </div>
  )
}
