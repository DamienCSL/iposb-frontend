import React, { useEffect, useState } from 'react'
import { Alert, Form, InputNumber, Modal, Space, Typography, message } from 'antd'
import { apiError, confirmAppOrder, previewAppOrderConfirm } from '../api/client'
import { money } from '../ui/bits'

const { Text } = Typography

/**
 * Double-confirm customer-app bookings: staff verifies weight + dimensions, re-quotes, then confirms.
 */
export default function ConfirmAppOrderModal({
  open,
  cnNo,
  initial = {},
  onClose,
  onConfirmed,
}) {
  const [form] = Form.useForm()
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    if (!open) return
    const dims = initial.dimensions || initial
    form.setFieldsValue({
      weightKg: Number(dims.weightKg ?? dims.weight ?? dims.cn_wt ?? 1) || 1,
      pieces: Number(dims.pieces ?? dims.cn_pcs ?? 1) || 1,
      lengthCm: Number(dims.lengthCm ?? dims.length_cm ?? 10) || 10,
      widthCm: Number(dims.widthCm ?? dims.width_cm ?? 10) || 10,
      heightCm: Number(dims.heightCm ?? dims.height_cm ?? 10) || 10,
    })
    setPreview(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cnNo])

  async function runPreview(values) {
    setPreviewing(true)
    try {
      const res = await previewAppOrderConfirm(cnNo, values)
      setPreview(res)
      return res
    } catch (err) {
      message.error(apiError(err) || 'Preview failed')
      setPreview(null)
      return null
    } finally {
      setPreviewing(false)
    }
  }

  async function onOk() {
    try {
      const values = await form.validateFields()
      setBusy(true)
      let quote = preview
      if (!quote) {
        quote = await runPreview(values)
        if (!quote) return
      }
      const res = await confirmAppOrder(cnNo, values)
      message.success(res?.message || `Confirmed ${cnNo}`)
      onConfirmed?.(res)
      onClose?.()
    } catch (err) {
      if (err?.errorFields) return
      message.error(apiError(err) || 'Confirm failed')
    } finally {
      setBusy(false)
    }
  }

  const payMissing = Number(preview?.payMissingRm || 0)

  return (
    <Modal
      open={open}
      title={`Confirm app order · ${cnNo || '—'}`}
      okText="Confirm weight & dimensions"
      okButtonProps={{ loading: busy, style: { background: '#1B8A5A', borderColor: '#1B8A5A' } }}
      cancelButtonProps={{ disabled: busy }}
      onCancel={onClose}
      onOk={onOk}
      destroyOnClose
      width={520}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Confirm actual weight and dimensions after pickup. Courier can scan PKU first; onward hub/station scans need this confirm."
      />
      <Form
        form={form}
        layout="vertical"
        onValuesChange={() => setPreview(null)}
      >
        <Space wrap size="middle" style={{ width: '100%' }}>
          <Form.Item
            name="weightKg"
            label="Weight (kg)"
            rules={[{ required: true, message: 'Required' }]}
            style={{ marginBottom: 12 }}
          >
            <InputNumber min={0.01} step={0.1} precision={3} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item
            name="pieces"
            label="Pieces"
            rules={[{ required: true, message: 'Required' }]}
            style={{ marginBottom: 12 }}
          >
            <InputNumber min={1} step={1} precision={0} style={{ width: 100 }} />
          </Form.Item>
        </Space>
        <Space wrap size="middle">
          <Form.Item
            name="lengthCm"
            label="Length (cm)"
            rules={[{ required: true, message: 'Required' }]}
            style={{ marginBottom: 12 }}
          >
            <InputNumber min={1} step={1} style={{ width: 110 }} />
          </Form.Item>
          <Form.Item
            name="widthCm"
            label="Width (cm)"
            rules={[{ required: true, message: 'Required' }]}
            style={{ marginBottom: 12 }}
          >
            <InputNumber min={1} step={1} style={{ width: 110 }} />
          </Form.Item>
          <Form.Item
            name="heightCm"
            label="Height (cm)"
            rules={[{ required: true, message: 'Required' }]}
            style={{ marginBottom: 12 }}
          >
            <InputNumber min={1} step={1} style={{ width: 110 }} />
          </Form.Item>
        </Space>
      </Form>

      <Space style={{ marginBottom: 8 }}>
        <a
          onClick={async () => {
            const values = await form.validateFields().catch(() => null)
            if (values) await runPreview(values)
          }}
        >
          {previewing ? 'Re-quoting…' : 'Preview re-quote'}
        </a>
      </Space>

      {preview ? (
        <Alert
          type={payMissing > 0 ? 'warning' : 'success'}
          showIcon
          message={
            payMissing > 0
              ? `New total ${money(preview.newTotalRm)} — customer must pay missing ${money(payMissing)}`
              : `New total ${money(preview.newTotalRm)} — no top-up needed`
          }
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Previous {money(preview.previousTotalRm)}
              {preview.refundHintRm > 0 ? ` · lower by ${money(preview.refundHintRm)}` : ''}
            </Text>
          }
        />
      ) : null}
    </Modal>
  )
}
