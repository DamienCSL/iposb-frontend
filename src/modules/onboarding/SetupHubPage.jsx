import React, { useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Result,
  Space,
  Steps,
  Typography,
  message,
} from 'antd'
import {
  AppstoreAddOutlined,
  BankOutlined,
  CheckCircleFilled,
  EnvironmentOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { apiError, saveMaster } from '../../api/client'

const { Title, Text, Paragraph } = Typography

export default function SetupHubPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [branchData, setBranchData] = useState(null)
  const [hubData, setHubData] = useState(null)

  const [branchForm] = Form.useForm()
  const [hubForm] = Form.useForm()
  const [dpForm] = Form.useForm()

  // Step 1: Create First Branch
  async function handleCreateBranch(values) {
    setLoading(true)
    try {
      const res = await saveMaster('branches', values)
      message.success('Branch created successfully')
      setBranchData(values)
      hubForm.setFieldsValue({
        branch_code: values.branch_code,
        hub_code: `${values.branch_code}-HUB`,
        hub_name: `${values.branch_name} Central Hub`,
        hub_level: 'GATEWAY',
      })
      setCurrentStep(1)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Create First Hub
  async function handleCreateHub(values) {
    setLoading(true)
    try {
      await saveMaster('hubs', values)
      message.success('Central Hub created and linked to branch')
      setHubData(values)
      dpForm.setFieldsValue({
        branch_code: values.branch_code,
        hub_code: values.hub_code,
        drop_code: `DP-${values.branch_code}-01`,
        drop_name: `${values.hub_name} Counter 1`,
        drop_type: 'STATION',
      })
      setCurrentStep(2)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Create Optional Drop Point or Skip
  async function handleCreateDropPoint(values) {
    setLoading(true)
    try {
      if (values.drop_code) {
        await saveMaster('drop-points', values)
        message.success('Drop Point registered successfully')
      }
      setCurrentStep(3)
    } catch (err) {
      message.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F1B2D',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(27, 138, 90, 0.18)',
              padding: '6px 14px',
              borderRadius: 20,
              color: '#1B8A5A',
              fontWeight: 600,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <RocketOutlined /> INITIAL SYSTEM PROVISIONING
          </div>
          <Title level={2} style={{ color: '#FFFFFF', margin: '0 0 8px 0', letterSpacing: '-0.4px' }}>
            Setup First Hub & Branch
          </Title>
          <Paragraph style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>
            Welcome to IPOSB Freight Management System. Configure the initial physical network
            node before accessing the back-office operations control tower.
          </Paragraph>
        </div>

        <Card
          bordered={false}
          style={{
            borderRadius: 10,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          }}
          bodyStyle={{ padding: '28px 32px' }}
        >
          <Steps
            current={currentStep}
            size="small"
            style={{ marginBottom: 28 }}
            items={[
              { title: 'Branch', icon: <BankOutlined /> },
              { title: 'Hub', icon: <AppstoreAddOutlined /> },
              { title: 'Drop Point', icon: <EnvironmentOutlined /> },
              { title: 'Ready', icon: <CheckCircleFilled /> },
            ]}
          />

          {currentStep === 0 && (
            <Form form={branchForm} layout="vertical" onFinish={handleCreateBranch}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 15, color: '#0F1B2D' }}>
                  Step 1: Create Main Branch
                </Text>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  A branch represents the regional administrative operating company.
                </div>
              </div>

              <Form.Item
                label="Branch Code"
                name="branch_code"
                rules={[{ required: true, message: 'Branch code is required (e.g. BKI, KCH, KUL)' }]}
              >
                <Input placeholder="e.g. BKI" maxLength={6} style={{ textTransform: 'uppercase' }} />
              </Form.Item>

              <Form.Item
                label="Branch Name"
                name="branch_name"
                rules={[{ required: true, message: 'Branch name is required' }]}
              >
                <Input placeholder="e.g. Kota Kinabalu Main Branch" />
              </Form.Item>

              <Form.Item label="Contact Phone" name="phone">
                <Input placeholder="e.g. +60 88 123456" />
              </Form.Item>

              <Form.Item label="Address Line" name="address_line1">
                <Input.TextArea rows={2} placeholder="Office address" />
              </Form.Item>

              <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{ background: '#1B8A5A', borderColor: '#1B8A5A', height: 38 }}
                >
                  Create Branch & Continue
                </Button>
              </Form.Item>
            </Form>
          )}

          {currentStep === 1 && (
            <Form form={hubForm} layout="vertical" onFinish={handleCreateHub}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 15, color: '#0F1B2D' }}>
                  Step 2: Create Gateway Hub
                </Text>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Linked to branch <strong>{branchData?.branch_code}</strong> for consignment sorting and linehaul.
                </div>
              </div>

              <Form.Item
                label="Hub Code"
                name="hub_code"
                rules={[{ required: true, message: 'Hub code is required' }]}
              >
                <Input placeholder="e.g. BKI-HUB" style={{ textTransform: 'uppercase' }} />
              </Form.Item>

              <Form.Item
                label="Hub Name"
                name="hub_name"
                rules={[{ required: true, message: 'Hub name is required' }]}
              >
                <Input placeholder="e.g. BKI Central Gateway" />
              </Form.Item>

              <Form.Item label="Linked Branch Code" name="branch_code" rules={[{ required: true }]}>
                <Input disabled />
              </Form.Item>

              <Form.Item label="Hub Level" name="hub_level">
                <Input placeholder="e.g. GATEWAY" />
              </Form.Item>

              <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button onClick={() => setCurrentStep(0)}>Back</Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    style={{ background: '#1B8A5A', borderColor: '#1B8A5A', height: 38 }}
                  >
                    Create Hub & Continue
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}

          {currentStep === 2 && (
            <Form form={dpForm} layout="vertical" onFinish={handleCreateDropPoint}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 15, color: '#0F1B2D' }}>
                  Step 3: Initial Drop Point (Optional)
                </Text>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Register a counter or drop-off location, or skip this step to finish setup.
                </div>
              </div>

              <Form.Item label="Drop Point Code" name="drop_code">
                <Input placeholder="e.g. DP-BKI-01" style={{ textTransform: 'uppercase' }} />
              </Form.Item>

              <Form.Item label="Drop Point Name" name="drop_name">
                <Input placeholder="e.g. Inanam Service Counter" />
              </Form.Item>

              <Form.Item label="Linked Hub" name="hub_code">
                <Input disabled />
              </Form.Item>

              <Form.Item label="Station Type" name="drop_type">
                <Input placeholder="STATION" />
              </Form.Item>

              <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button onClick={() => setCurrentStep(3)}>Skip this step</Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    style={{ background: '#1B8A5A', borderColor: '#1B8A5A', height: 38 }}
                  >
                    Save & Finish
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}

          {currentStep === 3 && (
            <Result
              status="success"
              title="System Ready for Operations"
              subTitle={`Branch ${branchData?.branch_code || ''} and Hub ${hubData?.hub_code || ''} are live. You can now access the full operations control tower.`}
              extra={[
                <Button
                  key="dashboard"
                  type="primary"
                  size="large"
                  onClick={() => navigate('/ops/dashboard')}
                  style={{ background: '#1B8A5A', borderColor: '#1B8A5A' }}
                >
                  Go to Control Tower Dashboard
                </Button>,
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
