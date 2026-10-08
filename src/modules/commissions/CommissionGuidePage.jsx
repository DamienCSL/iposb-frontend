import React from 'react'
import { Alert, Anchor, Button, Card, Col, Divider, Row, Space, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, CalculatorOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Paragraph, Text } = Typography

function FormulaBox({ children }) {
  return (
    <div
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        background: '#f6f8fa',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        padding: '10px 14px',
        margin: '8px 0 12px',
        whiteSpace: 'pre-wrap',
      }}
    >
      {children}
    </div>
  )
}

function ExampleBox({ title = 'Example', children }) {
  return (
    <div
      style={{
        background: '#f0f7ff',
        border: '1px solid #cfe3ff',
        borderRadius: 6,
        padding: '10px 14px',
        margin: '8px 0 12px',
      }}
    >
      <Text strong style={{ display: 'block', marginBottom: 4 }}>{title}</Text>
      {children}
    </div>
  )
}

function Section({ id, tag, title, children }) {
  return (
    <Card id={id} style={{ marginBottom: 16, scrollMarginTop: 80 }}>
      <Space align="center" style={{ marginBottom: 4 }}>
        {tag ? <Tag color="geekblue">{tag}</Tag> : null}
        <Title level={4} style={{ margin: 0 }}>{title}</Title>
      </Space>
      {children}
    </Card>
  )
}

const legacyColumns = [
  { title: 'Line', dataIndex: 'line', key: 'line', width: 200 },
  { title: 'Formula', dataIndex: 'formula', key: 'formula' },
  { title: 'Example (5 pcs, 3.5 kg)', dataIndex: 'example', key: 'example', width: 220 },
]

const legacyRows = [
  {
    key: 'hub',
    line: 'Origin DP — hub-count',
    formula: 'First 3 pcs × RM 0.70, then each extra pc × RM 0.30',
    example: '2.10 + 0.60 = RM 2.70',
  },
  {
    key: 'lorry',
    line: 'Linehaul / lorry',
    formula: 'Weight × RM/kg (default 0.60)',
    example: '3.5 × 0.60 = RM 2.10',
  },
  {
    key: 'dwell',
    line: 'Dest DP — warehouse dwell',
    formula:
      'Paid by nights the parcel sits: T0 same day RM 1.50 · T1 1.40 · T2 1.30 · T3 1.20 · T4 1.10 · T5 1.00, then −RM 0.10 per extra night (floor RM 0.50)',
    example: 'Same day → RM 1.50',
  },
  {
    key: 'deliv',
    line: 'Dest DP — dwell tiers off',
    formula: 'Weight × RM/kg (default 0.60)',
    example: '3.5 × 0.60 = RM 2.10',
  },
  {
    key: 'disp',
    line: 'Dispatcher',
    formula: 'Flat RM per delivery (default 0.30)',
    example: 'RM 0.30',
  },
]

const pctColumns = [
  { title: 'Role', dataIndex: 'role', key: 'role' },
  { title: '%', dataIndex: 'pct', key: 'pct', width: 70 },
  { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 100 },
  { title: 'Paid to', dataIndex: 'paidTo', key: 'paidTo' },
]

const pctRows = [
  { key: 'od', role: 'Origin drop point', pct: '10%', amount: 'RM 0.98', paidTo: 'Origin drop point (counter)' },
  { key: 'hub', role: 'Sorting hub', pct: '15%', amount: 'RM 1.47', paidTo: 'Hub' },
  { key: 'lh', role: 'Linehaul', pct: '20%', amount: 'RM 1.96', paidTo: 'Linehaul' },
  { key: 'dd', role: 'Destination drop point', pct: '5%', amount: 'RM 0.49', paidTo: 'Stacked → destination DP (doorstep)' },
  { key: 'ddp', role: 'Destination DP', pct: '20%', amount: 'RM 1.96', paidTo: 'Destination DP' },
  { key: 'tr', role: 'Extra transport', pct: '5%', amount: 'RM 0.49', paidTo: 'Destination DP (doorstep only)' },
]

const gatingColumns = [
  { title: 'Role', dataIndex: 'role', key: 'role', width: 200 },
  { title: 'When is it paid, and to whom?', dataIndex: 'rule', key: 'rule' },
]

const gatingRows = [
  { key: 'od', role: 'Origin drop point', rule: 'Drop-off at counter → paid to the origin drop point. Courier pickup → stacked onto the origin delivery point.' },
  { key: 'odp', role: 'Origin delivery point', rule: 'Only when a courier picked the parcel up (ADDRESS_PICKUP).' },
  { key: 'hub', role: 'Sorting hub', rule: 'Hub franchisee share for sorting.' },
  { key: 'lh', role: 'Linehaul / subline', rule: 'Accrued after the leg is delivered.' },
  { key: 'dd', role: 'Destination drop point', rule: 'Self-collect → paid to the destination drop point. Doorstep → stacked onto the destination DP.' },
  { key: 'ddp', role: 'Destination delivery point', rule: 'Always paid.' },
  { key: 'tr', role: 'Extra transport', rule: 'Doorstep delivery only.' },
  { key: 'cu', role: 'Customs', rule: 'Declaration / handling share.' },
  { key: 'di', role: 'Dispatcher', rule: 'Usually paid through Collect SLA tiers instead (see below).' },
]

export default function CommissionGuidePage() {
  const navigate = useNavigate()

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ops/commissions/rates')}>
          Back to rate settings
        </Button>
        <Button icon={<CalculatorOutlined />} onClick={() => navigate('/ops/commissions/calculator')}>
          Open what-if calculator
        </Button>
      </Space>

      <Title level={2} style={{ marginTop: 0 }}>Commission &amp; delivery fee guide</Title>
      <Paragraph type="secondary" style={{ maxWidth: 900 }}>
        How the Commission Rates page works: first the <Text strong>delivery fee</Text> the customer pays is
        calculated using one of five formulas, then that fee is <Text strong>split into commission</Text> using
        one of two engines, with an optional <Text strong>Collect SLA</Text> bonus for self-collect parcels.
      </Paragraph>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, maxWidth: 900 }}
        message="All numbers on this page are illustrative examples, not your configured rates. Use the what-if calculator to test real settings."
      />

      <Row gutter={24}>
        <Col xs={24} lg={18}>
          <Title level={3}>Part 1 — Delivery fee formulas</Title>
          <Paragraph type="secondary">
            On <Text strong>Customer pricing</Text>, each transport mode uses one of these three formulas, for the
            public price, for a specific customer, or for a lane override. Customer and lane settings win over the
            public price.
          </Paragraph>

          <Section id="base_pcs_kg" tag="base_pcs_kg" title="1. Base + pieces + kg (default)">
            <FormulaBox>Fee = Base + (Pieces × RM/pc) + (Weight kg × RM/kg)</FormulaBox>
            <ExampleBox>
              Base RM 5.00, RM 1.00/pc, RM 0.80/kg — parcel of 2 pcs, 3.5 kg
              <FormulaBox>5.00 + (2 × 1.00) + (3.5 × 0.80) = RM 9.80</FormulaBox>
            </ExampleBox>
            <Paragraph>
              <Text strong>Use for:</Text> normal local corridors. Simple linear pricing and the only formula that
              charges per piece.
            </Paragraph>
          </Section>

          <Section id="step_linear" tag="step_linear" title="2. Step / linear (e.g. Sarawak)">
            <FormulaBox>
              {'If weight fits an early tier → Fee = tier price\nOtherwise → Fee = Anchor + ceil((Weight − Step from) ÷ Step size) × RM per step\nAbove the cap → + over-cap steps'}
            </FormulaBox>
            <ExampleBox>
              Tiers ≤0.5 kg = RM 5, ≤1 kg = RM 6 · from 1 kg add RM 1.00 every 0.5 kg · anchor RM 6 · cap 30 kg,
              then RM 0.80 per 1 kg
              <FormulaBox>
                {'0.8 kg → tier ≤1 kg = RM 6.00\n3.2 kg → ceil(2.2 ÷ 0.5) = 5 steps → 6.00 + 5 × 1.00 = RM 11.00\n32 kg → steps stop at 30 kg: ceil(29 ÷ 0.5) = 58 → 6 + 58 = 64.00\n        over cap: 2 kg × 0.80 = 1.60 → total RM 65.60'}
              </FormulaBox>
            </ExampleBox>
            <Paragraph>
              <Text strong>Use for:</Text> fixed prices for light parcels, then a staircase increase, with a
              different (usually cheaper) rate for very heavy parcels. The anchor defaults to the last tier&apos;s price
              and the step start defaults to the last tier&apos;s weight.
            </Paragraph>
          </Section>

          <Section id="size_weight" tag="size_weight" title="3. Size tiers (by weight)">
            <FormulaBox>
              {'Size = first size whose max weight fits the parcel\nFee = size price + max(0, Weight − flat covers up to) × RM/kg\n(flat covers up to defaults to where the size starts)'}
            </FormulaBox>
            <ExampleBox>
              S ≤5 kg = RM 6 · M 5–15 kg = RM 10 flat up to 10 kg, then RM 1/kg · XL unlimited = RM 30 + RM 1.50/kg above 15 kg
              <FormulaBox>
                {'8 kg → M = RM 10.00\n13 kg → M: 10.00 + (13 − 10) × 1.00 = RM 13.00\n22 kg → XL: 30.00 + (22 − 15) × 1.50 = RM 40.50'}
              </FormulaBox>
            </ExampleBox>
            <Paragraph>
              <Text strong>Use for:</Text> simple size-based price lists. The size is picked automatically from the
              chargeable weight. With <Text strong>Weight per piece</Text>, each piece is sized on its own share of the
              weight and the size price is charged per piece.
            </Paragraph>
          </Section>

          <Divider />
          <Title level={3}>Part 2 — How the fee becomes commission</Title>
          <Paragraph type="secondary">
            Chosen on the <Text strong>Engine</Text> tab. Only one engine is active at a time.
          </Paragraph>

          <Section id="legacy_rm" tag="legacy_rm" title="Engine A — Legacy RM (fixed amounts)">
            <Paragraph>Each party receives a fixed amount, regardless of the delivery fee.</Paragraph>
            <Table
              size="small"
              pagination={false}
              columns={legacyColumns}
              dataSource={legacyRows}
              scroll={{ x: 640 }}
            />
            <Paragraph style={{ marginTop: 12 }}>
              <Text strong>Why dwell tiers?</Text> They reward the destination DP for moving parcels out quickly —
              the longer a parcel sits, the less they earn.
            </Paragraph>
          </Section>

          <Section id="pct_matrix" tag="pct_matrix" title="Engine B — % matrix (share of the fee)">
            <FormulaBox>Each role&apos;s share = Fee base × role % (per transport mode)</FormulaBox>
            <ul>
              <li>A mode-specific row (Air / Land / Sea) wins over an &quot;All modes&quot; row for the same role.</li>
              <li>
                <Text strong>Fee base</Text> (global, can be changed per customer override):
                <ul>
                  <li><Text strong>Charged</Text> — what the customer actually paid, after their discount.</li>
                  <li>
                    <Text strong>List</Text> — the public price before customer discount, which protects franchisees
                    from customer discounts.
                  </li>
                </ul>
              </li>
              <li>Whatever percentage is not assigned stays with the company (e.g. roles total 75% → company keeps 25%).</li>
            </ul>
            <ExampleBox>
              Fee RM 9.80 · doorstep delivery · customer dropped the parcel at the counter
              <Table
                size="small"
                pagination={false}
                columns={pctColumns}
                dataSource={pctRows}
                style={{ marginTop: 8 }}
                scroll={{ x: 560 }}
              />
            </ExampleBox>
            <Title level={5} style={{ marginTop: 16 }}>Who gets paid — rules per role</Title>
            <Table
              size="small"
              pagination={false}
              columns={gatingColumns}
              dataSource={gatingRows}
              scroll={{ x: 560 }}
            />
          </Section>

          <Divider />
          <Title level={3}>Part 3 — Collect SLA bonus</Title>

          <Section id="collect_sla" tag="Collect SLA" title="Collect SLA (self-collect only)">
            <FormulaBox>
              {'Hours from drop-point arrival → customer collects\n→ first tier where hours ≤ max hours\n→ bonus = Fee × tier %'}
            </FormulaBox>
            <ExampleBox>
              T1 ≤24 h = 5% · T2 ≤48 h = 4% · T3 ≤72 h = 3% … — fee RM 9.80, collected after 30 hours
              <FormulaBox>30 h → T2 → 9.80 × 4% = RM 0.39</FormulaBox>
            </ExampleBox>
            <ul>
              <li>
                <Text strong>SLA payee</Text> decides who receives it: dispatcher, destination DP, or both (each gets
                the full tier %).
              </li>
              <li>
                When the dispatcher receives the SLA bonus, the dispatcher&apos;s normal matrix % is skipped so they
                are not paid twice.
              </li>
              <li>Only applies to the % matrix engine.</li>
            </ul>
            <Paragraph>
              <Text strong>Why?</Text> Faster collection earns a higher bonus, which encourages following up with
              customers.
            </Paragraph>
          </Section>
        </Col>

        <Col xs={0} lg={6}>
          <Card size="small" title="On this page" style={{ position: 'sticky', top: 80 }}>
            <Anchor
              offsetTop={80}
              items={[
                {
                  key: 'p1',
                  href: '#base_pcs_kg',
                  title: 'Delivery fee formulas',
                  children: [
                    { key: 'f1', href: '#base_pcs_kg', title: 'Base + pcs + kg' },
                    { key: 'f2', href: '#step_linear', title: 'Step / linear' },
                    { key: 'f3', href: '#size_weight', title: 'Size tiers (by weight)' },
                  ],
                },
                {
                  key: 'p2',
                  href: '#legacy_rm',
                  title: 'Commission engines',
                  children: [
                    { key: 'e1', href: '#legacy_rm', title: 'Legacy RM' },
                    { key: 'e2', href: '#pct_matrix', title: '% matrix' },
                  ],
                },
                { key: 'p3', href: '#collect_sla', title: 'Collect SLA' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
