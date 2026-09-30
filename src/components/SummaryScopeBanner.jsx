import React from 'react'
import { Alert } from 'antd'

export default function SummaryScopeBanner({ scope }) {
  if (!scope) return null
  if (scope.unbound) {
    return (
      <Alert
        type="warning"
        showIcon
        message="No delivery node assigned"
        description={scope.message || 'Ask an Admin to set your home node in Staff Users.'}
      />
    )
  }
  if (!scope.restricted) return null
  return (
    <Alert
      type="info"
      showIcon
      message={`Showing only consignments for ${scope.label}`}
      description={scope.message || undefined}
    />
  )
}
