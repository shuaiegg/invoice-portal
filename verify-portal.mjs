import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const DIR = '/tmp/portal-verify';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const t0 = Date.now();
const ts = () => `[+${((Date.now()-t0)/1000).toFixed(1)}s]`;
let n = 0;
const shot = async (page, name) => {
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2,'0')}-${name}.png`, fullPage: true });
};
const errors = [];

// Pre-compile all routes and warm up Neon (avoids HMR mid-request and Neon cold start)
console.log('Pre-compiling routes and warming DB...');
await Promise.all([
  fetch(`${BASE}/login`).catch(() => {}),
  fetch(`${BASE}/register`).catch(() => {}),
  fetch(`${BASE}/dashboard`).catch(() => {}),
  fetch(`${BASE}/admin`).catch(() => {}),
  fetch(`${BASE}/profile`).catch(() => {}),
  fetch(`${BASE}/invoice/new`).catch(() => {}),
  fetch(`${BASE}/admin/invoices`).catch(() => {}),
  // Warm up auth API routes (POST with dummy body to force Turbopack compilation)
  fetch(`${BASE}/api/auth/sign-up/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}),
  fetch(`${BASE}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}),
  fetch(`${BASE}/api/auth/get-session`).catch(() => {}),
  fetch(`${BASE}/api/invoices`).catch(() => {}),
  fetch(`${BASE}/api/profile`).catch(() => {}),
]);
// Give Turbopack time to finish compiling all routes + Neon to warm up
await new Promise(r => setTimeout(r, 5000));
console.log('Routes ready.');

// ── 1. Root ──────────────────────────────────────────────────────────────────
const p1 = await browser.newPage();
p1.on('console', m => m.type() === 'error' && errors.push(m.text()));
await p1.goto(BASE, { waitUntil: 'networkidle' });
console.log(`1. Root → ${p1.url()}`);
console.log(p1.url().includes('/login') ? '  ✅ redirected to /login' : '  ⚠️  stayed at root (no redirect)');
await shot(p1, 'root');

// ── 2. Login page ─────────────────────────────────────────────────────────────
await p1.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
const loginOk = await p1.locator('#email').count() > 0 && await p1.locator('#password').count() > 0;
console.log(`2. Login page: ${loginOk ? '✅ email+password inputs found' : '❌ inputs missing'}`);
await shot(p1, 'login');

// ── 3. Register first user (ADMIN) ────────────────────────────────────────────
await p1.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
// Log all auth API calls with timestamps
p1.on('request', req => { if (req.url().includes('/api/auth')) console.log(`  ${ts()} REQ ${req.method()} ${req.url().replace(BASE,'')}`); });
p1.on('response', res => { if (res.url().includes('/api/auth')) console.log(`  ${ts()} RES ${res.status()} ${res.url().replace(BASE,'')}`); });
await p1.locator('#name').fill('Admin User');
await p1.locator('#email').fill('admin@test.com');
await p1.locator('#password').fill('test123456');
await shot(p1, 'register-admin-filled');
// Wait for the sign-up API response explicitly (Neon cold start can take 60s+)
const [signUpRes1] = await Promise.all([
  p1.waitForResponse(res => res.url().includes('/api/auth/sign-up'), { timeout: 90000 }),
  p1.locator('button[type="submit"]').click(),
]);
console.log(`  ${ts()} Sign-up API → ${signUpRes1.status()}`);
// Poll until the page is no longer at /register AND has content (redirect chain can take time)
await p1.waitForFunction(() =>
  !window.location.pathname.includes('register') && document.body.innerText.length > 50,
  { timeout: 90000, polling: 500 }
).catch(() => {});
const adminUrl = p1.url();
console.log(`${ts()} 3. Admin register → ${adminUrl}`);
console.log(adminUrl.includes('/admin') ? '  ✅ redirected to /admin (ADMIN role confirmed)' : `  ❌ wrong redirect: ${adminUrl}`);
await shot(p1, 'admin-dashboard');

// ── 4. Admin dashboard content ────────────────────────────────────────────────
const cards = await p1.locator('[class*="card"]').count();
const pageText = await p1.locator('body').innerText();
console.log(`4. Admin dashboard: ${cards} cards, has "Invoice" text: ${pageText.includes('Invoice') || pageText.includes('invoice')}`);
await shot(p1, 'admin-dashboard-content');

// ── 5. Register second user (WORKER) ─────────────────────────────────────────
const p2 = await browser.newPage();
p2.on('console', m => m.type() === 'error' && errors.push('[worker] ' + m.text()));
await p2.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await p2.locator('#name').fill('Test Worker');
await p2.locator('#email').fill('worker@test.com');
await p2.locator('#password').fill('test123456');
// DB is warm after admin signup — this should be fast
const [signUpRes2] = await Promise.all([
  p2.waitForResponse(res => res.url().includes('/api/auth/sign-up'), { timeout: 30000 }),
  p2.locator('button[type="submit"]').click(),
]);
console.log(`  Sign-up API → ${signUpRes2.status()}`);
await p2.waitForFunction(() =>
  !window.location.pathname.includes('register') && document.body.innerText.length > 50,
  { timeout: 90000, polling: 500 }
).catch(() => {});
const workerUrl = p2.url();
console.log(`5. Worker register → ${workerUrl}`);
console.log(workerUrl.includes('/dashboard') ? '  ✅ redirected to /dashboard (WORKER role confirmed)' : `  ❌ wrong redirect: ${workerUrl}`);
await shot(p2, 'worker-dashboard');

// ── 6. Profile completion banner ──────────────────────────────────────────────
const dashText = await p2.locator('body').innerText();
const hasBanner = dashText.toLowerCase().includes('profile') && (dashText.toLowerCase().includes('complete') || dashText.toLowerCase().includes('complet'));
console.log(`6. Profile banner: ${hasBanner ? '✅ visible' : '⚠️  not detected (check screenshot)'}`);
await shot(p2, 'worker-dashboard-banner');

// ── 7. Fill profile ──────────────────────────────────────────────────────────
await p2.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
await shot(p2, 'profile-empty');
// Fill all required fields using id selectors
for (const [id, val] of [['name','Test Worker'],['address','123 Rue de la Paix'],['city','Paris'],['country','France']]) {
  const el = p2.locator(`#${id}`);
  if (await el.count() > 0) await el.fill(val);
}
// Payment method — could be select or input
const pmSelect = p2.locator('#paymentMethod, select[name="paymentMethod"]');
if (await pmSelect.count() > 0) {
  const tag = await pmSelect.evaluate(el => el.tagName);
  if (tag === 'SELECT') await pmSelect.selectOption({ index: 1 });
  else await pmSelect.fill('Bank Transfer');
} else {
  const pmInput = p2.locator('input').filter({ hasText: /payment/i }).first();
  if (await pmInput.count() > 0) await pmInput.fill('Bank Transfer');
}
await shot(p2, 'profile-filled');
await p2.locator('button[type="submit"]').click();
await p2.waitForTimeout(2000);
const profileText = await p2.locator('body').innerText();
const savedOk = profileText.toLowerCase().includes('saved') || profileText.toLowerCase().includes('success') || profileText.toLowerCase().includes('updated');
console.log(`7. Profile save: ${savedOk ? '✅ success message shown' : '⚠️  no success toast detected'}`);
await shot(p2, 'profile-saved');

// ── 8. Dashboard after profile ────────────────────────────────────────────────
await p2.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
const dashText2 = await p2.locator('body').innerText();
const bannerGone = !dashText2.toLowerCase().includes('complete your profile');
const newInvoiceLink = await p2.locator('a[href*="/invoice/new"]').count() > 0;
console.log(`8. Dashboard post-profile: banner gone=${bannerGone ? '✅' : '❌'}, New Invoice link=${newInvoiceLink ? '✅' : '⚠️'}`);
await shot(p2, 'dashboard-after-profile');

// ── 9. Submit invoice ─────────────────────────────────────────────────────────
await p2.goto(`${BASE}/invoice/new`, { waitUntil: 'networkidle' });
await shot(p2, 'invoice-form');
const invText = await p2.locator('body').innerText();
const formLoaded = invText.includes('Invoice') || invText.includes('Description') || invText.includes('Period');
console.log(`9a. Invoice form loaded: ${formLoaded ? '✅' : '❌'}`);

// Fill fields by id
const fieldMap = { description: 'Web development services - June 2026', period: 'June 2026', quantity: '10', rate: '500' };
for (const [id, val] of Object.entries(fieldMap)) {
  const el = p2.locator(`#${id}, textarea[name="${id}"], input[name="${id}"]`).first();
  if (await el.count() > 0) { await el.fill(''); await el.fill(val); }
}
await shot(p2, 'invoice-form-filled');
const [invoiceRes] = await Promise.all([
  p2.waitForResponse(res => res.url().includes('/api/invoices') && res.request().method() === 'POST', { timeout: 30000 }),
  p2.locator('button[type="submit"]').click(),
]);
console.log(`  Invoice API → ${invoiceRes.status()}`);
await p2.waitForFunction(() =>
  window.location.pathname.includes('/invoice/') && !window.location.pathname.includes('/new'),
  { timeout: 30000, polling: 500 }
).catch(() => {});
const invoiceDetailUrl = p2.url();
const submittedOk = invoiceDetailUrl.includes('/invoice/') && !invoiceDetailUrl.includes('/new');
console.log(`9b. Invoice submit → ${invoiceDetailUrl}`);
console.log(`  ${submittedOk ? '✅ redirected to invoice detail' : '❌ still on form'}`);
await shot(p2, 'invoice-detail');

// ── 10. Invoice detail checks ─────────────────────────────────────────────────
if (submittedOk) {
  const detailText = await p2.locator('body').innerText();
  console.log(`10. Invoice detail:`);
  console.log(`  Invoice #: ${detailText.includes('INV-') ? '✅' : '❌'}`);
  console.log(`  Amount (€): ${detailText.includes('€') || detailText.includes('5 000') || detailText.includes('5000') ? '✅' : '⚠️'}`);
  console.log(`  Status SUBMITTED: ${detailText.toLowerCase().includes('submitted') ? '✅' : '⚠️'}`);
  const printBtn = await p2.locator('button:has-text("Print"), button:has-text("PDF"), button:has-text("Download")').count() > 0;
  console.log(`  Print button: ${printBtn ? '✅' : '⚠️'}`);
  await shot(p2, 'invoice-detail-content');
}

// ── 11. Dashboard shows invoice ───────────────────────────────────────────────
await p2.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
const hasInvInDash = await p2.locator('text=INV-').count() > 0;
console.log(`11. Dashboard shows invoice: ${hasInvInDash ? '✅' : '❌'}`);
await shot(p2, 'dashboard-with-invoice');

// ── 🔍 Probe: worker blocked from /admin ──────────────────────────────────────
await p2.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
const blockedUrl = p2.url();
const blocked = !blockedUrl.includes('/admin') || blockedUrl.includes('/login') || blockedUrl.includes('/dashboard');
console.log(`🔍 Worker → /admin: ${blocked ? '✅ blocked' : '❌ NOT blocked'} (ended at ${blockedUrl})`);
await shot(p2, 'worker-blocked-from-admin');

// ── 🔍 Probe: API 403 for worker ─────────────────────────────────────────────
const apiStatus = await p2.evaluate(async () => (await fetch('/api/admin/stats')).status);
console.log(`🔍 /api/admin/stats as worker: ${apiStatus === 403 ? '✅ 403' : `❌ got ${apiStatus}`}`);

// ── 🔍 Probe: admin sees all invoices ────────────────────────────────────────
await p1.goto(`${BASE}/admin/invoices`, { waitUntil: 'networkidle' });
const adminSeesInv = await p1.locator('text=INV-').count() > 0;
console.log(`🔍 Admin /invoices shows worker's invoice: ${adminSeesInv ? '✅' : '⚠️  not found'}`);
await shot(p1, 'admin-sees-invoices');

await browser.close();

console.log('\n--- Console errors ---');
if (errors.length === 0) console.log('✅ None');
else errors.slice(0, 15).forEach(e => console.log('  ⚠️ ', e));
console.log(`\nScreenshots → ${DIR}/`);
