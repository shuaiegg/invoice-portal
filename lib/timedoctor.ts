const TD_API_BASE = "https://api2.timedoctor.com";

export type TdMonthlyHours = {
  userId: string;
  email: string;
  name: string;
  totalSec: number;
};

export function hoursFromSeconds(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

export function monthlyRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23));
  return { from: start.toISOString(), to: end.toISOString() };
}

export function isTokenExpiringSoon(expiresAt: Date | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000;
}

export async function getTimeDoctorAuth() {
  const { db } = await import("./db");
  const config = await db.timeDoctorConfig.findUnique({ where: { id: "singleton" } });
  if (!config) throw new Error("Time Doctor is not configured");
  if (config.tokenExpiresAt && config.tokenExpiresAt <= new Date()) {
    throw new Error("Time Doctor token has expired");
  }
  return config;
}

function dataArray(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === "object") {
    const nested = Object.values(data).find(Array.isArray);
    if (nested) return nested as Array<Record<string, unknown>>;
  }
  return [];
}

export function mergeTdUsersAndStats(
  users: Array<Record<string, unknown>>,
  stats: Array<Record<string, unknown>>,
): TdMonthlyHours[] {
  const secondsByUser = new Map(stats.map((stat) => [String(stat.userId ?? stat.id), Number(stat.totalSec ?? 0)]));
  return users.map((user) => {
    const userId = String(user.id ?? user.userId ?? "");
    return {
      userId,
      email: String(user.email ?? "").trim().toLowerCase(),
      name: String(user.name ?? [user.firstName, user.lastName].filter(Boolean).join(" ") ?? ""),
      totalSec: secondsByUser.get(userId) ?? 0,
    };
  });
}

const TD_PAGE_LIMIT = 200;
const TD_MAX_ROWS = 10_000;

// TD caps every list endpoint at 200 rows and paginates by row offset via `page`.
// stats/total honors limit/page but returns NO paging metadata (verified against
// the live API), so the only reliable stop signal is a short page.
export async function fetchAllPages(
  url: URL,
  headers: Record<string, string>,
  label: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; offset < TD_MAX_ROWS; offset += TD_PAGE_LIMIT) {
    url.searchParams.set("limit", String(TD_PAGE_LIMIT));
    url.searchParams.set("page", String(offset));
    const response = await fetchImpl(url, { method: "GET", headers });
    if (!response.ok) throw new Error(`Time Doctor ${label} request failed (${response.status})`);
    const page = dataArray(await response.json());
    rows.push(...page);
    if (page.length < TD_PAGE_LIMIT) break;
  }
  return rows;
}

export async function fetchMonthlyHours(
  year: number,
  month: number,
  fetchImpl: typeof fetch = fetch,
): Promise<TdMonthlyHours[]> {
  const config = await getTimeDoctorAuth();
  const { from, to } = monthlyRange(year, month);
  const headers = { Authorization: `JWT ${config.apiToken}`, Accept: "application/json" };
  const statsUrl = new URL("/api/1.1/stats/total", TD_API_BASE);
  statsUrl.search = new URLSearchParams({
    company: config.companyId,
    user: "all",
    "group-by": "userId",
    fields: "totalSec",
    from,
    to,
  }).toString();
  const usersUrl = new URL("/api/1.0/users", TD_API_BASE);
  usersUrl.search = new URLSearchParams({ company: config.companyId }).toString();

  const [stats, users] = await Promise.all([
    fetchAllPages(statsUrl, headers, "hours", fetchImpl),
    fetchAllPages(usersUrl, headers, "users", fetchImpl),
  ]);
  return mergeTdUsersAndStats(users, stats);
}

export type TdLoginResult = {
  token: string;
  companyId: string;
  tokenExpiresAt: Date | null;
};

export async function loginToTimeDoctor(
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TdLoginResult> {
  const response = await fetchImpl(new URL("/api/1.0/authorization/login", TD_API_BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Time Doctor rejected that email/password"
        : `Time Doctor login failed (${response.status})`,
    );
  }
  const payload = await response.json();
  const token = payload?.data?.token;
  const companyId = payload?.data?.companies?.[0]?.id;
  if (typeof token !== "string" || !token || typeof companyId !== "string" || !companyId) {
    throw new Error("Time Doctor login response did not include a token and company ID");
  }
  // Time Doctor's token is an opaque string, not a JWT (no dot-separated payload to decode) —
  // the login response's own top-level `expiresAt` is the only source for this, verified against the live API.
  const expiresAtRaw = payload?.data?.expiresAt;
  const tokenExpiresAt = typeof expiresAtRaw === "string" && !Number.isNaN(Date.parse(expiresAtRaw))
    ? new Date(expiresAtRaw)
    : null;
  return { token, companyId, tokenExpiresAt };
}

export function tokenExpiryFromJwt(token: string): Date | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

// TD's "team" concept is its generic tag feature. Every user carries the company-wide
// allUsersTagId (from GET /api/1.0/companies/{id}) plus zero or more real team tags (from
// GET /api/1.0/tags) — resolving a user's team means excluding the catch-all tag and naming
// whichever real tag remains. If a user has multiple real tags, the first one wins (TD's UI
// itself only shows one primary team per person in most views).
export function resolveTeamsByEmail(
  companyPayload: unknown,
  tagsPayload: unknown,
  usersPayload: unknown,
): Map<string, string> {
  const allUsersTagId = (companyPayload as { data?: { allUsersTagId?: unknown } })?.data?.allUsersTagId;
  const tagNamesById = new Map(
    dataArray(tagsPayload).map((tag) => [String(tag.id), String(tag.name ?? "")]),
  );

  const teamsByEmail = new Map<string, string>();
  for (const user of dataArray(usersPayload)) {
    const email = String(user.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const tagIds = Array.isArray(user.tagIds) ? (user.tagIds as unknown[]).map(String) : [];
    const teamTagId = tagIds.find((id) => id !== allUsersTagId);
    const teamName = teamTagId ? tagNamesById.get(teamTagId) : undefined;
    if (teamName) teamsByEmail.set(email, teamName);
  }
  return teamsByEmail;
}

export async function fetchTeamsByEmail(fetchImpl: typeof fetch = fetch): Promise<Map<string, string>> {
  const config = await getTimeDoctorAuth();
  const headers = { Authorization: `JWT ${config.apiToken}`, Accept: "application/json" };
  const withCompany = (path: string) => {
    const url = new URL(path, TD_API_BASE);
    url.search = new URLSearchParams({ company: config.companyId }).toString();
    return url;
  };

  const [companyResponse, tags, users] = await Promise.all([
    fetchImpl(withCompany(`/api/1.0/companies/${config.companyId}`), { method: "GET", headers }),
    fetchAllPages(withCompany("/api/1.0/tags"), headers, "tags", fetchImpl),
    fetchAllPages(withCompany("/api/1.0/users"), headers, "users", fetchImpl),
  ]);
  if (!companyResponse.ok) {
    throw new Error("Time Doctor team lookup failed");
  }
  const companyPayload = await companyResponse.json();
  return resolveTeamsByEmail(companyPayload, { data: tags }, { data: users });
}

export async function testTimeDoctorConnection(token: string, companyId: string, fetchImpl: typeof fetch = fetch) {
  const url = new URL("/api/1.0/users", TD_API_BASE);
  url.search = new URLSearchParams({ company: companyId, limit: "1" }).toString();
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Authorization: `JWT ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Time Doctor connection test failed (${response.status})`);
}
