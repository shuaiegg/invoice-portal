import test from "node:test";
import assert from "node:assert/strict";
import { hoursFromSeconds, isTokenExpiringSoon, loginToTimeDoctor, mergeTdUsersAndStats, monthlyRange, resolveTeamsByEmail, testTimeDoctorConnection } from "../lib/timedoctor.ts";

// Time Doctor's real token is an opaque string with no dots — not a JWT. Verified against the live API.
const fakeTdToken = "opaque-td-token-no-dots";

test("hoursFromSeconds rounds tracked seconds to two decimals", () => {
  assert.equal(hoursFromSeconds(575999), 160);
  assert.equal(hoursFromSeconds(4500), 1.25);
});

test("monthlyRange uses the requested UTC month with the documented one-hour end buffer", () => {
  assert.deepEqual(monthlyRange(2026, 6), {
    from: "2026-06-01T00:00:00.000Z",
    to: "2026-06-30T23:00:00.000Z",
  });
});

test("isTokenExpiringSoon warns within fourteen days", () => {
  const now = new Date("2026-07-01T00:00:00Z");
  assert.equal(isTokenExpiringSoon(new Date("2026-07-14T00:00:00Z"), now), true);
  assert.equal(isTokenExpiringSoon(new Date("2026-07-16T00:00:00Z"), now), false);
});

test("mergeTdUsersAndStats retains users with zero tracked hours", () => {
  const result = mergeTdUsersAndStats(
    [{ id: "u1", email: "one@example.com", name: "One" }, { id: "u2", email: "two@example.com", name: "Two" }],
    [{ userId: "u1", totalSec: 3600 }],
  );
  assert.equal(result[0].totalSec, 3600);
  assert.equal(result[1].totalSec, 0);
});

test("testTimeDoctorConnection sends the JWT auth scheme Time Doctor's API actually requires, not Bearer", async () => {
  let capturedHeaders: HeadersInit | undefined;
  const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
    capturedHeaders = init?.headers;
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as typeof fetch;

  await testTimeDoctorConnection("token-123", "company-abc", fakeFetch);

  const headers = capturedHeaders as Record<string, string>;
  assert.equal(headers.Authorization, "JWT token-123");
});

test("loginToTimeDoctor extracts the token, first company ID, and expiresAt from a real-shaped login response", async () => {
  let capturedBody: string | undefined;
  const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
    capturedBody = init?.body as string;
    return new Response(JSON.stringify({
      data: {
        id: "u1", email: "api@example.com", token: fakeTdToken,
        companies: [{ id: "company-abc" }], expiresAt: "2027-01-10T02:57:26.455Z",
      },
    }), { status: 200 });
  }) as typeof fetch;

  const result = await loginToTimeDoctor("api@example.com", "secret", fakeFetch);

  assert.deepEqual(JSON.parse(capturedBody!), { email: "api@example.com", password: "secret" });
  assert.equal(result.token, fakeTdToken);
  assert.equal(result.companyId, "company-abc");
  // tokenExpiresAt comes from the response's own `expiresAt` field, not decoded from the token —
  // Time Doctor's token isn't a JWT, so tokenExpiryFromJwt() would silently return null here.
  assert.equal(result.tokenExpiresAt?.toISOString(), "2027-01-10T02:57:26.455Z");
});

test("resolveTeamsByEmail excludes the company-wide catch-all tag and names the real team", () => {
  // Shapes verified against the live API: GET /api/1.0/companies/{id}, GET /api/1.0/tags, GET /api/1.0/users
  const companyPayload = { data: { allUsersTagId: "all-tag" } };
  const tagsPayload = { data: [
    { id: "all-tag", name: "All Regular Users" },
    { id: "dev-tag", name: "Developers" },
    { id: "support-tag", name: "Support team" },
  ] };
  const usersPayload = { data: [
    { email: "DEV@example.com", tagIds: ["all-tag", "dev-tag"] },
    { email: "support@example.com", tagIds: ["all-tag", "support-tag"] },
    { email: "noteam@example.com", tagIds: ["all-tag"] },
    { email: "notags@example.com", tagIds: [] },
  ] };

  const teams = resolveTeamsByEmail(companyPayload, tagsPayload, usersPayload);

  assert.equal(teams.get("dev@example.com"), "Developers"); // matched case-insensitively, normalized to lowercase
  assert.equal(teams.get("support@example.com"), "Support team");
  assert.equal(teams.has("noteam@example.com"), false); // only the catch-all tag — no real team
  assert.equal(teams.has("notags@example.com"), false);
});

test("loginToTimeDoctor surfaces a clear error on bad credentials", async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({ error: "invalidCredentials" }), { status: 401 })) as typeof fetch;
  await assert.rejects(() => loginToTimeDoctor("api@example.com", "wrong", fakeFetch), /rejected that email\/password/);
});
