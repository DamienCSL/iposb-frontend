import React, { useState } from 'react'
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  Row,
  Typography,
} from 'antd'
import StatusTag from '../components/StatusTag'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { checkFirstRun } from '../api/client'

const { Title, Text } = Typography

const allowDemoLogin =
  String(import.meta.env.VITE_ALLOW_DEMO_LOGIN || '').toLowerCase() === 'true'

export default function LoginPage() {
  const { user, login, booting } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (booting) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#F8FAFC',
          color: '#64748B',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Initializing IPOSB Control Tower…
      </div>
    )
  }

  if (user) {
    return <Navigate to="/ops/dashboard" replace />
  }

  async function onFinish(values) {
    setError('')
    setBusy(true)
    try {
      const session = await login(values.username, values.password)
      const isAdminUser = ['Super Admin', 'Admin'].includes(session?.role)

      // First-run detection per PRD 6.1
      const firstRunInfo = await checkFirstRun().catch(() => ({ isFirstRun: false }))
      if (firstRunInfo?.isFirstRun) {
        if (isAdminUser) {
          navigate('/onboarding/setup-hub', { replace: true })
          return
        } else {
          setError('System setup pending — please contact your system administrator.')
          setBusy(false)
          return
        }
      }

      const to = location.state?.from || '/ops/dashboard'
      navigate(to, { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid username or password. Please verify your credentials.')
    } finally {
      setBusy(false)
    }
  }

  function handleQuickFill() {
    form.setFieldsValue({
      username: 'admin',
      password: 'admin123',
    })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#F4F6F8',
        backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Central Floating Dual-Card Container */}
      <div
        style={{
          maxWidth: 960,
          width: '100%',
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 20px 45px -12px rgba(15, 27, 45, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}
      >
        <Row>
          {/* Left Column: Brand Showcase & Operational Highlights */}
          <Col
            xs={24}
            md={12}
            style={{
              background: 'linear-gradient(155deg, #F8FAFC 0%, #F1F5F9 55%, #ECFDF5 100%)',
              borderRight: '1px solid #E2E8F0',
              padding: '44px 36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {/* Official Brand Logo (Natural Transparent Rendering) */}
              <div style={{ marginBottom: 28 }}>
                <img
                  src="/logo.png"
                  alt="IPOSB"
                  style={{
                    height: 52,
                    width: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>

              <div>
                <StatusTag status="ACTIVE" text="Logistics Control Tower" color="#1B8A5A" />
                <Title
                  level={3}
                  style={{
                    fontWeight: 700,
                    color: '#0F1B2D',
                    marginTop: 12,
                    marginBottom: 8,
                    letterSpacing: '-0.3px',
                  }}
                >
                  Freight Operations Portal
                </Title>
                <Text
                  style={{
                    color: '#64748B',
                    fontSize: 13,
                    lineHeight: 1.6,
                    display: 'block',
                  }}
                >
                  Unified operating suite orchestrating consignment booking, hub sorting, linehaul
                  manifest transit, and courier dispatch.
                </Text>
              </div>

              {/* Three Feature Highlights */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '9px 12px',
                  }}
                >
                  <CheckCircleOutlined style={{ color: '#1B8A5A', fontSize: 15 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0F1B2D' }}>
                      8-Stage SOP Milestone Stepper
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Origin booking to proof of delivery
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '9px 12px',
                  }}
                >
                  <CheckCircleOutlined style={{ color: '#1668DC', fontSize: 15 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0F1B2D' }}>
                      Fleet & 3PL Route Dispatch
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Direct driver assignment & remote handoffs
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '9px 12px',
                  }}
                >
                  <CheckCircleOutlined style={{ color: '#D97706', fontSize: 15 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0F1B2D' }}>
                      Throughput Share Analytics
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Segmented volume by status, branch & date
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Compliance Strip */}
            <div
              style={{
                borderTop: '1px solid #E2E8F0',
                paddingTop: 16,
                marginTop: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: '#64748B',
              }}
            >
              <SafetyCertificateOutlined style={{ color: '#1B8A5A', fontSize: 14 }} />
              <span>RBAC Protected · 256-bit TLS Session · Multi-Branch Active</span>
            </div>
          </Col>

          {/* Right Column: Clean Sign In Form */}
          <Col
            xs={24}
            md={12}
            style={{
              background: '#FFFFFF',
              padding: '44px 38px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div>
              <div style={{ marginBottom: 24 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#1B8A5A',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  Staff Terminal
                </span>
                <Title
                  level={3}
                  style={{
                    margin: '4px 0 0',
                    fontWeight: 700,
                    color: '#0F1B2D',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Back-Office Sign In
                </Title>
                <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
                  Enter your credentials to enter the workspace
                </Text>
              </div>

              {error && (
                <Alert
                  message={error}
                  type="error"
                  showIcon
                  style={{ marginBottom: 20, borderRadius: 8 }}
                />
              )}

              <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{ username: '', password: '' }}
              >
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Username</span>}
                  name="username"
                  rules={[{ required: true, message: 'Please enter your username' }]}
                  style={{ marginBottom: 16 }}
                >
                  <Input
                    prefix={<UserOutlined style={{ color: '#94A3B8' }} />}
                    placeholder="Enter staff username"
                    size="large"
                    style={{ borderRadius: 8, height: 44, fontSize: 13 }}
                  />
                </Form.Item>

                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Password</span>}
                  name="password"
                  rules={[{ required: true, message: 'Please enter your password' }]}
                  style={{ marginBottom: 20 }}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
                    placeholder="Enter password"
                    size="large"
                    style={{ borderRadius: 8, height: 44, fontSize: 13 }}
                  />
                </Form.Item>

                {allowDemoLogin ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 20,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: '#64748B' }}>Default: admin / admin123</span>
                    <Button
                      type="link"
                      size="small"
                      onClick={handleQuickFill}
                      style={{ padding: 0, fontSize: 12, color: '#1B8A5A', fontWeight: 500 }}
                    >
                      Fill Demo
                    </Button>
                  </div>
                ) : null}

                <Form.Item style={{ marginBottom: 12 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={busy}
                    icon={<ArrowRightOutlined />}
                    style={{
                      height: 44,
                      background: '#1B8A5A',
                      borderColor: '#1B8A5A',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                      boxShadow: '0 2px 6px rgba(27, 138, 90, 0.25)',
                    }}
                  >
                    Sign In to Control Tower
                  </Button>
                </Form.Item>
              </Form>

              <div
                style={{
                  textAlign: 'center',
                  marginTop: 18,
                  fontSize: 11,
                  color: '#94A3B8',
                }}
              >
                © {new Date().getFullYear()} IPOSB Courier & Freight Network. All rights reserved.
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  )
}
