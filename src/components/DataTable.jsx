import React from 'react'
import { Table } from 'antd'

export default function DataTable({
  className = '',
  rowClassName,
  size = 'small',
  cardStyle,
  ...restProps
}) {
  return (
    <div className={`data-table-card data-table-${size} ${className}`.trim()} style={cardStyle}>
      <Table
        size={size}
        rowClassName={(record, index) => {
          const zebra = index % 2 === 1 ? 'row-zebra' : ''
          const custom = typeof rowClassName === 'function' ? rowClassName(record, index) : rowClassName || ''
          return `${zebra} ${custom}`.trim()
        }}
        {...restProps}
      />
    </div>
  )
}
