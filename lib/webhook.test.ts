import { test, mock } from "node:test";
import assert from "node:assert";
import { dispatchWebhook } from "./webhook";
import { db } from "./db";

test("dispatchWebhook should fetch config and call fetch", async (t) => {
  // Mock db.webhookConfig.findUnique
  // Using a simpler mock if mock.method fails
  const originalFindUnique = db.webhookConfig.findUnique;
  (db.webhookConfig as any).findUnique = async () => {
    return {
      key: "test.key",
      url: "https://example.com/webhook",
      enabled: true,
      secret: "test-secret",
    };
  };

  // Mock global fetch
  const originalFetch = global.fetch;
  const fetchMock = mock.fn(async () => {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  global.fetch = fetchMock as any;

  try {
    // Call the function
    dispatchWebhook("test.key", { foo: "bar" });

    // Since it's fire-and-forget, we need to wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(fetchMock.mock.callCount(), 1);

    const [url, options]: [string, any] = fetchMock.mock.calls[0].arguments as any;
    assert.strictEqual(url, "https://example.com/webhook");
    assert.strictEqual(options.method, "POST");
    assert.strictEqual(options.headers["X-Webhook-Secret"], "test-secret");
    
    const body = JSON.parse(options.body as string);
    assert.strictEqual(body.foo, "bar");
    assert.ok(body.timestamp);
  } finally {
    // Restore
    (db.webhookConfig as any).findUnique = originalFindUnique;
    global.fetch = originalFetch;
  }
});

test("dispatchWebhook should not call fetch if disabled", async (t) => {
  const originalFindUnique = db.webhookConfig.findUnique;
  (db.webhookConfig as any).findUnique = async () => {
    return {
      key: "test.key",
      url: "https://example.com/webhook",
      enabled: false,
    };
  };

  const originalFetch = global.fetch;
  const fetchMock = mock.fn();
  global.fetch = fetchMock as any;

  try {
    dispatchWebhook("test.key", { foo: "bar" });

    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(fetchMock.mock.callCount(), 0);
  } finally {
    (db.webhookConfig as any).findUnique = originalFindUnique;
    global.fetch = originalFetch;
  }
});
