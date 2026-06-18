#!/usr/bin/env node
/**
 * MCP stdio-to-HTTP bridge for n8n-mcp (Streamable HTTP transport).
 * Replaces mcp-remote which hangs on OAuth discovery for this server.
 * Processes messages sequentially to ensure session ID is set before use.
 */
const https = require('https');
const readline = require('readline');

const MCP_URL = 'https://n8n-mcp.scaletotop.com/mcp';
const AUTH_TOKEN = '6Xck59W7KFCOfFCKlswlk8VyCwOHblv3LvHIk/XIV1U=';

let sessionId = null;
let processing = false;
const queue = [];

function sendToServer(body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const url = new URL(MCP_URL);
    const headers = {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(bodyStr),
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers,
    }, (res) => {
      if (res.headers['mcp-session-id']) sessionId = res.headers['mcp-session-id'];
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        for (const line of data.split('\n')) {
          if (line.startsWith('data: ')) {
            try { return resolve(JSON.parse(line.slice(6))); } catch {}
          }
        }
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function processNext() {
  if (processing || queue.length === 0) return;
  processing = true;
  const msg = queue.shift();

  // Notifications (no id): fire-and-forget, don't block the queue
  if (msg.id === undefined) {
    sendToServer(msg).catch(() => {}).finally(() => {
      processing = false;
      processNext();
    });
    return;
  }

  try {
    const result = await sendToServer(msg);
    if (result) process.stdout.write(JSON.stringify(result) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0', id: msg.id,
      error: { code: -32603, message: e.message },
    }) + '\n');
  }
  processing = false;
  processNext();
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    queue.push(JSON.parse(line));
    processNext();
  } catch {}
});

rl.on('close', () => process.exit(0));
