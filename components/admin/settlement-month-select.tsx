"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SettlementMonthSelect({ months, value }: { months: string[]; value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <Select value={value} onValueChange={(month) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", month);
      router.push(`/admin?${params.toString()}`);
    }}>
      <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
      <SelectContent>
        {months.map((month) => <SelectItem key={month} value={month}>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-02`))}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
