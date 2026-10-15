import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Card, Empty, Input, Spin, Tag, Timeline, Typography } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, EnvironmentOutlined } from '@ant-design/icons'
import { publicTracking } from '../api/client'

const { Title, Text } = Typography

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function errorText(err) {
  const status = err?.response?.status
  if (status === 404) return 'We could not find this tracking number. Please check it and try again.'
  if (status === 429) return 'Too many searches. Please wait a minute and try again.'
  return 'Tracking is temporarily unavailable. Please try again later.'
}

function statusTag(data) {
  if (data.cancelled) return <Tag icon={<CloseCircleFilled />} color="red">Cancelled</Tag>
  if (data.delivered) return <Tag icon={<CheckCircleFilled />} color="green">Delivered</Tag>
  return <Tag color="blue">{data.status || 'In Transit'}</Tag>
}

export default function PublicTrackingPage() {
  const [params, setParams] = useSearchParams()
  const cn = (params.get('cn') || '').trim().toUpperCase()
  const [input, setInput] = useState(cn)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setInput(cn)
    setData(null)
    setError('')
    if (!cn) return
    let cancelled = false
    setLoading(true)
    publicTracking(cn)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(errorText(err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [cn])

  function search(value) {
    const next = String(value || '').trim().toUpperCase()
    if (next) setParams({ cn: next })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '32px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <img src="/logo.png" alt="IPOSB" style={{ height: 40 }} />
          <Title level={3} style={{ margin: 0 }}>Track your parcel</Title>
        </div>

        <Input.Search
          size="large"
          placeholder="Enter tracking number"
          enterButton="Track"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSearch={search}
          loading={loading}
          allowClear
          autoFocus
        />

        <div style={{ marginTop: 20 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
            </div>
          )}

          {!loading && error && <Alert type="warning" showIcon message={error} />}

          {!loading && !error && !data && (
            <Card>
              <Empty description="Enter the tracking number printed on your consignment note, or scan its QR code." />
            </Card>
          )}

          {!loading && data && (
            <>
              <Card style={{ marginBottom: 16 }}>
                <Text type="secondary">Tracking number</Text>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <Title level={4} style={{ margin: 0, fontFamily: 'monospace' }}>{data.cnNo}</Title>
                  {statusTag(data)}
                </div>
                {data.detail && <div style={{ marginTop: 8, fontSize: 15 }}>{data.detail}</div>}
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  {data.origin && (
                    <div><Text type="secondary">From</Text><div>{data.origin}</div></div>
                  )}
                  {data.destination && (
                    <div><Text type="secondary">To</Text><div>{data.destination}</div></div>
                  )}
                  {data.recipient && (
                    <div><Text type="secondary">Recipient</Text><div>{data.recipient}</div></div>
                  )}
                  {data.delivered && data.deliveredDate && (
                    <div>
                      <Text type="secondary">Delivered on</Text>
                      <div>{[data.deliveredDate, data.deliveredTime].filter(Boolean).join(' ')}</div>
                    </div>
                  )}
                  {!data.delivered && !data.cancelled && data.estimatedDeliveryAt && (
                    <div><Text type="secondary">Estimated delivery</Text><div>{formatDateTime(data.estimatedDeliveryAt)}</div></div>
                  )}
                </div>
              </Card>

              <Card title="Tracking history">
                {data.timeline?.length ? (
                  <Timeline
                    items={data.timeline.map((t, i) => ({
                      color: i === 0 ? (data.delivered ? 'green' : 'blue') : 'gray',
                      children: (
                        <div>
                          <div style={{ fontWeight: i === 0 ? 600 : 400 }}>{t.detail || t.status}</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {formatDateTime(t.at)}
                            {t.location && (
                              <>
                                {' · '}
                                <EnvironmentOutlined /> {t.location}
                              </>
                            )}
                          </Text>
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Empty description="No scans yet — your parcel will update once it is picked up." />
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
