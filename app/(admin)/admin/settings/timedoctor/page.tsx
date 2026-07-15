import { TimeDoctorSettings } from "@/components/admin/timedoctor-settings";
import { db } from "@/lib/db";
import { isTokenExpiringSoon } from "@/lib/timedoctor";

export default async function TimeDoctorSettingsPage() {
  const config = await db.timeDoctorConfig.findUnique({ where: { id: "singleton" } });
  return <TimeDoctorSettings initial={config ? {
    companyId: config.companyId,
    tokenExpiresAt: config.tokenExpiresAt?.toISOString() ?? null,
    expiringSoon: isTokenExpiringSoon(config.tokenExpiresAt),
  } : null} />;
}
