type MatchableWorker = {
  timeDoctorEmail: string | null;
  user: { email: string; active: boolean } | null;
};

export type TdWorkerMatch<T> =
  | { kind: "matched"; worker: T }
  | { kind: "inactive" }
  | { kind: "unmatched" };

export function buildTdWorkerMatcher<T extends MatchableWorker>(workers: T[]) {
  const preferredEligible = new Map<string, T>();
  const preferredInactive = new Set<string>();
  const fallbackEligible = new Map<string, T>();
  const fallbackInactive = new Set<string>();

  for (const worker of workers) {
    const eligible = worker.user === null || worker.user.active;
    const preferredEmail = worker.timeDoctorEmail?.trim().toLowerCase();
    const fallbackEmail = worker.user?.email.trim().toLowerCase();
    if (preferredEmail) {
      if (eligible && !preferredEligible.has(preferredEmail)) preferredEligible.set(preferredEmail, worker);
      if (!eligible) preferredInactive.add(preferredEmail);
    }
    if (fallbackEmail) {
      if (eligible && !fallbackEligible.has(fallbackEmail)) fallbackEligible.set(fallbackEmail, worker);
      if (!eligible) fallbackInactive.add(fallbackEmail);
    }
  }

  return {
    match(email: string): TdWorkerMatch<T> {
      const normalized = email.trim().toLowerCase();
      const preferred = preferredEligible.get(normalized);
      if (preferred) return { kind: "matched", worker: preferred };
      if (preferredInactive.has(normalized)) return { kind: "inactive" };
      const fallback = fallbackEligible.get(normalized);
      if (fallback) return { kind: "matched", worker: fallback };
      if (fallbackInactive.has(normalized)) return { kind: "inactive" };
      return { kind: "unmatched" };
    },
  };
}
