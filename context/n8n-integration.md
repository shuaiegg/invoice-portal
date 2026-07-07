# n8n 通知集成配置指南

本文档描述 Invoice Portal 与 n8n 之间的接口约定。

当前架构决策：

- Xero 由 Portal 直接同步。
- Time Doctor 由 Portal 直接轮询/同步。
- Wise 由 Portal 直接调用 API，并由 Portal 直接接收 Wise webhook。
- n8n 只负责通知，不负责财务状态、不负责付款、不负责会计写入。

---

## 架构概览

```text
Worker / Admin action
  -> Invoice Portal
      -> Portal writes DB state
      -> Portal syncs Xero directly when required
      -> Portal polls Time Doctor directly when required
      -> Portal calls Wise directly when required
      -> Portal emits notification event to n8n
          -> n8n sends Slack/email notifications
```

n8n 工作流只由 **Webhook Trigger** 启动。Portal 不使用 n8n API 触发执行。

---

## 一、n8n 的职责边界

### n8n 可以做

- Slack 通知
- Email 通知
- Finance channel 摘要消息
- Operational reminders
- 失败告警 fan-out

### n8n 不可以做

- 创建或更新 Xero invoice/bill
- 回调 Portal 更新 Xero sync status
- 调用 Wise 创建 quote/recipient/transfer/payment
- 接收 Wise webhook 并把 invoice 标记为 Paid
- 读取 Time Doctor 并生成 invoice
- 修改 Portal 中的 invoice/payment/accounting 状态
- 作为财务审计 source of truth

原则：

```text
All financial source-of-truth writes happen in Portal.
n8n is notification-only.
```

---

## 二、Portal -> n8n 出站 Webhook

Portal 以 fire-and-forget 方式把通知事件发送给 n8n。

通知失败不应阻塞主流程：

- invoice 创建成功不依赖 n8n。
- Xero sync 成功不依赖 n8n。
- Wise payment 状态更新不依赖 n8n。
- n8n 失败时，Portal 应在本地记录或日志中保留错误，但不回滚财务状态。

### 请求格式

```http
POST <Admin Settings 中配置的 n8n Webhook URL>
Content-Type: application/json
X-Webhook-Secret: <optional shared secret>
```

### 通用 Payload

```json
{
  "eventKey": "invoice.submitted",
  "eventId": "evt_clxxx",
  "timestamp": "2026-07-07T10:00:00.000Z",
  "environment": "production",
  "actor": {
    "id": "user_clxxx",
    "name": "Jack",
    "role": "ADMIN"
  },
  "invoice": {
    "id": "inv_clxxx",
    "invoiceNumber": "INV-2026-0008",
    "period": "June 2026",
    "status": "APPROVED",
    "totalAmount": 6000,
    "currency": "EUR",
    "xeroSynced": true
  },
  "worker": {
    "id": "worker_clxxx",
    "name": "Test Worker",
    "email": "worker@example.com",
    "team": "Engineering"
  },
  "message": {
    "title": "Invoice approved",
    "summary": "INV-2026-0008 approved for 6000 EUR"
  }
}
```

Payload rules:

- Include enough display data for notification formatting.
- Do not include secrets, full bank details, Wise tokens, Xero tokens, or raw payment credentials.
- Include IDs so Slack messages can link back to Portal.
- Include `environment` so n8n can ignore development events in production workflows.

---

## 三、Recommended Event Keys

### Invoice lifecycle

| Event Key | Trigger | Suggested recipient |
| --- | --- | --- |
| `invoice.submitted` | Worker manually submits invoice | Finance channel |
| `invoice.updated` | Worker updates editable invoice | Finance channel, if review relevant |
| `invoice.revoked` | Worker voids/revokes submitted invoice | Finance channel |
| `invoice.generated` | Portal generates invoice from Time Doctor | Worker/developer |
| `invoice.review_requested` | Worker/developer submits adjustments for review | Felipe/Finance reviewer |
| `invoice.returned` | Finance returns invoice for changes | Worker/developer |
| `invoice.approved` | Finance approves invoice | Finance channel |
| `invoice.paid` | Portal records payment | Worker + Finance channel |
| `invoice.voided` | Admin voids invoice | Finance channel |

### Integration lifecycle

| Event Key | Trigger | Suggested recipient |
| --- | --- | --- |
| `xero.sync_succeeded` | Portal successfully syncs Xero | Optional finance log |
| `xero.sync_failed` | Portal fails to sync Xero | Admin/Finance alert |
| `timedoctor.sync_completed` | Scheduled sync completes | Admin/Finance summary |
| `timedoctor.sync_failed` | Scheduled sync fails | Admin alert |
| `wise.payment_run_created` | Portal creates a payment run | Finance channel |
| `wise.payment_sent` | Wise webhook confirms outgoing payment sent | Worker + Finance channel |
| `wise.payment_failed` | Wise transfer/payment fails | Admin/Finance alert |

---

## 四、n8n Workflow Pattern

推荐每类通知用一个 webhook workflow，或者一个总入口根据 `eventKey` 分流。

```text
[Webhook Trigger]
    -> Verify X-Webhook-Secret
    -> If environment is allowed
    -> Switch on eventKey
    -> Format Slack/email message
    -> Send notification
```

n8n workflow 不应调用 Portal 的 write APIs。  
如果未来需要通知重发，应该调用只读 endpoint 获取展示数据，或者由 Portal 重新发 notification event。

---

## 五、环境区分

Portal 发出的 webhook 包含 `environment` 字段。

环境由以下优先级决定：

1. `WEBHOOK_ENVIRONMENT`
2. `NODE_ENV`
3. fallback: `development`

建议：

- development 使用 n8n test webhook URL。
- production 使用 n8n production webhook URL。
- n8n workflow 必须检查 `environment`，避免开发数据进入正式 Slack channel。

---

## 六、快速检查清单

- [ ] Admin Settings 中配置 notification webhook URL。
- [ ] `X-Webhook-Secret` 与 n8n workflow 校验值一致。
- [ ] n8n workflow 只发送通知，不调用 Xero/Wise/Time Doctor。
- [ ] n8n workflow 不调用 Portal write APIs。
- [ ] 所有 notification payload 不包含 tokens、bank details、payment secrets。
- [ ] Slack message 包含 Portal 链接，方便 Finance 回到系统处理。
- [ ] production workflow 会过滤非 production events。
