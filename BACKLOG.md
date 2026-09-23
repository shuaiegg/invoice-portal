# Backlog

---

## [refactor] 统一所有通知事件走 WebhookConfig → n8n — ✅ 已完成(2026-09-23)

> 代码改动、本地全量验证（8/8 非 TD 事件端到端跑通）、生产环境 n8n 接线（`n8n.team-sio.com` 单个 workflow，按 `eventKey` 分支，统一发到 #finance）均已完成。`lib/slack.ts` 与 `SLACK_WEBHOOK_URL` 已删除。保留本节作为迁移历史记录。

**背景**

目前系统有两条并行的出口路径：
1. `dispatchWebhook()` → WebhookConfig DB 里配置的 n8n URL（结构化 JSON）
2. `notifySlack()` → `SLACK_WEBHOOK_URL` 环境变量 → n8n（纯文本）

`invoice.submitted` 和 `invoice.updated` 同时走两条路，造成 n8n 收到重复触发。其余事件只走路径2，无法通过 Admin UI 管理。

**目标**

所有出站事件统一走 `dispatchWebhook()` → WebhookConfig → n8n，由 n8n 根据 `eventKey` 路由到不同 Slack 频道或其他系统。

**需要改动**

- [x] `app/api/invoices/route.ts` — 删除 `invoiceSubmitted()` 调用（保留 `dispatchWebhook`）
- [x] `app/api/invoices/[id]/route.ts` — 删除 `invoiceUpdated()` 调用（保留 `dispatchWebhook`）
- [x] `app/api/invoices/[id]/revoke/route.ts` — 替换 `notifySlack()` 为 `dispatchWebhook("invoice.revoked", {...})`
- [x] `app/api/admin/invoices/[id]/route.ts` — 替换 slack 调用为：
  - `dispatchWebhook("invoice.status_changed", {...})`
  - `dispatchWebhook("invoice.paid", {...})`（移除 MANUAL 条件限制）
  - `dispatchWebhook("invoice.changes_requested", {...})`
- [x] `app/api/admin/invoices/bulk-status/route.ts` — 替换为 `dispatchWebhook("invoice.bulk_completed", {...})`
- [x] `app/api/admin/workers/import/route.ts` — 替换 `tdWorkerInvite()` 为 `dispatchWebhook("worker.invited", {...})`
- [x] `lib/td-sync.ts` — 替换三个 slack 函数为：
  - `dispatchWebhook("td.sync_completed", {...})`
  - `dispatchWebhook("td.sync_failed", {})`
  - `dispatchWebhook("td.draft_ready", {...})`
- [x] 清理 `lib/slack.ts` 中不再使用的函数
- [x] `SLACK_WEBHOOK_URL` 环境变量可废弃
- [x] 在 Admin Settings → WebhookConfig 中为所有新 event key 配置 n8n URL
- [x] 更新 `lib/seed-webhooks.ts` 补充所有新 event key

**验证记录（2026-09-23）**

本地起 dev server + 一次性 HTTP 接收器，在 `WebhookConfig` 里用独立的 `development` environment（与 `production` 隔离）跑了一遍完整业务闭环：提交发票、编辑、撤回、审批、标记已付、打回修改、批量审批、CSV 导入 worker，8/8 非 TD 事件均实际触发且 payload 正确。`td.sync_completed`/`td.sync_failed`/`td.draft_ready` 因涉及真实 Time Doctor 数据未做端到端跑测，仅代码审查确认。

随后在生产环境把全部 11 个 event key 接到 `n8n.team-sio.com` 上新建的单个 workflow（Webhook → Code 按 eventKey 生成文案 → Slack 发到 #finance），curl 测试确认真实收到 Slack 消息。`invoice.submitted`/`invoice.updated` 原本指向的 `n8n.scaletotop.com` 已同步迁移。

`lib/slack.ts` 已删除（不再保留 fallback）。
