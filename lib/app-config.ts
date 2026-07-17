import { db } from "./db";

// Singleton row, absence == defaults (registrationOpen: true) — no seed migration needed, a
// fresh deploy behaves exactly like today until an admin explicitly closes registration.
export async function isRegistrationOpen(): Promise<boolean> {
  const config = await db.appConfig.findUnique({ where: { id: "singleton" } });
  return config?.registrationOpen ?? true;
}

export async function setRegistrationOpen(registrationOpen: boolean): Promise<void> {
  await db.appConfig.upsert({
    where: { id: "singleton" },
    update: { registrationOpen },
    create: { id: "singleton", registrationOpen },
  });
}
