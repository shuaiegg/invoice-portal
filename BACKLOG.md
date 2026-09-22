# Backlog

---

## [refactor] 统一所有通知事件走 WebhookConfig → n8n

**背景**

目前系统有两条并行的出口路径：
1. `dispatchWebhook()` → WebhookConfig DB 里配置的 n8n URL（结构化 JSON）
2. `notifySlack()` → `SLACK_WEBHOOK_URL` 环境变量 → n8n（纯文本）

`invoice.submitted` 和 `invoice.updated` 同时走两条路，造成 n8n 收到重复触发。其余事件只走路径2，无法通过 Admin UI 管理。

**目标**

所有出站事件统一走 `dispatchWebhook()` → WebhookConfig → n8n，由 n8n 根据 `eventKey` 路由到不同 Slack 频道或其他系统。

**需要改动**

- [ ] `app/api/invoices/route.ts` — 删除 `invoiceSubmitted()` 调用（保留 `dispatchWebhook`）
- [ ] `app/api/invoices/[id]/route.ts` — 删除 `invoiceUpdated()` 调用（保留 `dispatchWebhook`）
- [ ] `app/api/invoices/[id]/revoke/route.ts` — 替换 `notifySlack()` 为 `dispatchWebhook("invoice.revoked", {...})`
- [ ] `app/api/admin/invoices/[id]/route.ts` — 替换 slack 调用为：
  - `dispatchWebhook("invoice.status_changed", {...})`
  - `dispatchWebhook("invoice.paid", {...})`（移除 MANUAL 条件限制）
  - `dispatchWebhook("invoice.changes_requested", {...})`
- [ ] `app/api/admin/invoices/bulk-status/route.ts` — 替换为 `dispatchWebhook("invoice.bulk_completed", {...})`
- [ ] `app/api/admin/workers/import/route.ts` — 替换 `tdWorkerInvite()` 为 `dispatchWebhook("worker.invited", {...})`
- [ ] `lib/td-sync.ts` — 替换三个 slack 函数为：
  - `dispatchWebhook("td.sync_completed", {...})`
  - `dispatchWebhook("td.sync_failed", {})`
  - `dispatchWebhook("td.draft_ready", {...})`
- [ ] 清理 `lib/slack.ts` 中不再使用的函数
- [ ] `SLACK_WEBHOOK_URL` 环境变量可废弃
- [ ] 在 Admin Settings → WebhookConfig 中为所有新 event key 配置 n8n URL
- [ ] 更新 `lib/seed-webhooks.ts` 补充所有新 event key

**注意**

`lib/slack.ts` 中的 `notifySlack()` 和各事件函数可以保留但不再调用，待全部迁移验证后再删除。
