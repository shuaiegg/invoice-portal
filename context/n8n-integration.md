# n8n 集成配置指南

本文档描述 Invoice Portal 与 n8n 之间的所有接口约定，供搭建 n8n 工作流时参考。

---

## 架构概览

```
Worker 提交发票
  └─→ Next.js API (/api/invoices)
        └─→ fire-and-forget POST → n8n Webhook Trigger
                                       └─→ 创建 Xero 草稿账单
                                       └─→ 发 Slack 通知
                                       └─→ 回调 Next.js /api/internal/sync-status
```

n8n 工作流只由 **Webhook Trigger** 启动，Next.js 不使用 n8n API 触发任何执行。

---

## 一、Portal → n8n（出站 Webhook）

### 1.1 触发时机与事件 Key

| 事件 Key           | 触发时机                                       |
|--------------------|------------------------------------------------|
| `invoice.submitted`| Worker 首次提交发票                            |
| `invoice.updated`  | Worker 修改已提交（SUBMITTED）发票后重新保存   |
| `invoice.revoked`  | Worker 主动撤回一张 SUBMITTED 状态的发票       |

> **注意**：Portal 以 fire-and-forget 方式 POST，不等待 n8n 响应，不重试。n8n 工作流本身负责错误重试。

### 1.2 请求格式

```
POST <在 Admin → Settings → Webhooks 中配置的 URL>
Content-Type: application/json
X-Webhook-Secret: <在 Admin Settings 中设置的 secret>（如未配置则无此 header）
```

### 1.3 Payload 结构（大部分字段一致）

`eventKey` 会告诉 n8n 当前事件类型；`updatedAt` 会在 `invoice.submitted` 和 `invoice.updated` 中出现，用于 stale webhook 去重。

```json
{
  "eventKey": "invoice.submitted",
  "invoiceId": "clxxx...",
  "invoiceNumber": "INV-2026-0008",
  "updatedAt": "2026-06-17T11:29:30.000Z",
  "worker": {
    "id": "clxxx...",
    "name": "Test Worker",
    "email": "worker@example.com",
    "address": "123 Rue de la Paix",
    "city": "Paris",
    "country": "France",
    "vatNumber": "FR12345678901"
  },
  "invoice": {
    "description": "Software development services for June 2026",
    "period": "June 2026",
    "quantity": 20,
    "rate": 250,
    "subtotal": 5000.00,
    "vatAmount": 1000.00,
    "totalAmount": 6000.00,
    "currency": "EUR",
    "invoiceDate": "2026-06-17T00:00:00.000Z"
  },
  "xeroInvoiceId": null,
  "timestamp": "2026-06-17T11:30:00.000Z",
  "environment": "production"
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `invoiceId` | string | Portal 数据库中的发票 ID，回调时需要 |
| `invoiceNumber` | string | 格式 `INV-{YYYY}-{NNNN}` |
| `worker.email` | string | 联系邮箱 |
| `worker.vatNumber` | string \| null | 有的 Worker 没有 VAT 号 |
| `invoice.subtotal` | number | 税前金额（EUR） |
| `invoice.vatAmount` | number | VAT 金额 |
| `invoice.totalAmount` | number | 含税总额，即 subtotal + vatAmount |
| `invoice.invoiceDate` | ISO 8601 | UTC，显示时用 Europe/Paris 时区 |
| `xeroInvoiceId` | string \| null | 已同步到 Xero 的账单 ID，首次提交时为 null |
| `eventKey` | string | 事件标识，等于 `invoice.submitted` / `invoice.updated` / `invoice.revoked` |
| `updatedAt` | ISO 8601 | 发票上一轮更新时间；`invoice.submitted` 和 `invoice.updated` 事件会包含它，用于 stale webhook 去重 |
| `timestamp` | ISO 8601 | Webhook 发出时刻（UTC） |
| `environment` | string | `production` 或 `development` |

---

## 二、n8n → Portal（回调：invoice.submitted 和 invoice.updated）

发票在 Xero 创建成功后，n8n 需要回调 Portal，更新同步状态。`invoice.submitted` 和 `invoice.updated` 工作流都应使用同一个接口，并在 body 中携带 `eventKey`。回调将依据 `eventKey` 或 `internalSecret` 确认请求来源。

### 2.1 接口

```
POST https://<your-domain>/api/internal/sync-status
Content-Type: application/json
X-Internal-Secret: <internalSecret（在 Admin Settings 中配置）>
```

### 2.2 Request Body

```json
{
  "invoiceId": "clxxx...",
  "xeroInvoiceId": "INV-XERO-0001",
  "eventKey": "invoice.updated"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `invoiceId` | string | 从 Webhook payload 中取 `invoiceId` |
| `xeroInvoiceId` | string | Xero 创建草稿账单后返回的 InvoiceID |
| `eventKey` | string | 所触发的事件，`invoice.submitted` 或 `invoice.updated`；用于校验正确的 `internalSecret` |

### 2.3 响应

- `200 OK` `{ "success": true }` — 更新成功
- `400` — 缺少 `invoiceId` 或 `xeroInvoiceId`
- `401` — `X-Internal-Secret` 不匹配或未配置

---

## 三、Admin Settings 中的 WebhookConfig

在 **Admin → Settings → Webhooks** 页面中为每个事件配置：

| 字段 | 用途 | 示例 |
|------|------|------|
| **URL** | n8n Webhook Trigger 的 URL（Production 模式下为 `/webhook/...`，Test 模式为 `/webhook-test/...`） | `https://n8n.yourdomain.com/webhook/invoice-submitted` |
| **X-Webhook-Secret** | Portal 发出请求时携带的 header，n8n 用于验证来源（可选） | `my-shared-secret-xyz` |
| **Internal Secret** | n8n 回调 `/api/internal/sync-status` 时携带的 `X-Internal-Secret` header | `callback-secret-abc` |

> **两个 Secret 的区别**：
> - `X-Webhook-Secret` — Portal 出站时携带，n8n 验证"请求真的来自 Portal"
> - `X-Internal-Secret` — n8n 回调时携带，Portal 验证"回调真的来自 n8n"

---

## 四、推荐 n8n 工作流结构

### 4.1 invoice.submitted 工作流

```
[Webhook Trigger]
    ↓ 验证 X-Webhook-Secret（可选）
[If] xeroInvoiceId != null → 跳过（已同步，可能是重发）
    ↓
[Xero — Create Invoice]
    → Contact Name: {{ $json.worker.name }}
    → Reference: {{ $json.invoiceNumber }}
    → Line Item Desc: {{ $json.invoice.description }}
    → Quantity: {{ $json.invoice.quantity }}
    → Unit Amount: {{ $json.invoice.rate }}
    → Tax Amount: {{ $json.invoice.vatAmount }}
    → Total: {{ $json.invoice.totalAmount }}
    → Due Date: +30 days from invoiceDate
    ↓
[HTTP Request] POST /api/internal/sync-status
    → Header: X-Internal-Secret: <internalSecret>
    → Body: { invoiceId, xeroInvoiceId }
    ↓
[Slack — Send Message]
    → Channel: #finance
    → 消息模板见下方
```

**Slack 消息模板示例**：
```
📄 New invoice submitted
*{{ $json.worker.name }}* | {{ $json.invoice.period }}
Amount: {{ $json.invoice.totalAmount }} {{ $json.invoice.currency }}
Invoice #: {{ $json.invoiceNumber }}
Xero: Created ✅
```

### 4.2 invoice.updated 工作流

```
[Webhook Trigger]
    ↓
[If] xeroInvoiceId != null
    → [Xero — Update Invoice]（用 xeroInvoiceId 定位）
[Else]
    → [Xero — Create Invoice]（首次 update，Xero 还没有记录）
    ↓
[HTTP Request] POST /api/internal/sync-status（如新建了 Xero 账单）
```

### 4.3 invoice.revoked 工作流

```
[Webhook Trigger]
    ↓
[If] xeroInvoiceId != null
    → [Xero — Void Invoice]
    ↓
[Slack] 通知 #finance：Invoice {{ $json.invoiceNumber }} revoked
```

---

## 五、环境区分

Portal 发出的 Webhook 包含 `environment` 字段（`"production"` 或 `"development"`）。

环境由以下优先级决定：
1. 环境变量 `WEBHOOK_ENVIRONMENT`（如设置）
2. `NODE_ENV`（Next.js 默认 `production` 在 Vercel 上）

**建议配置**：
- 在 Admin Settings 中为 `development` 和 `production` 分别设置不同的 n8n URL（`/webhook-test/...` vs `/webhook/...`）
- 在 n8n 工作流中加 If 节点过滤 `environment`，防止开发数据进入正式 Xero

---

## 六、快速检查清单

- [ ] Admin Settings → Webhooks → `invoice.submitted` 的 URL 已填入 n8n Production Webhook URL
- [ ] `X-Webhook-Secret` 与 n8n Webhook Trigger 中设置的 Header Auth 一致
- [ ] `Internal Secret` 与 n8n HTTP Request 节点发出的 `X-Internal-Secret` 一致
- [ ] n8n 工作流中 `/api/internal/sync-status` 的回调 URL 指向 Portal 的正式域名
- [ ] Xero OAuth2 凭证已在 n8n Credentials 中配置
- [ ] Slack Bot Token 已在 n8n Credentials 中配置
