import { CalendarDays, Folder, ListChecks, Mail } from "lucide-react";
import type { ServiceKey } from "@/lib/services";

const icons = { calendar: CalendarDays, tasks: ListChecks, gmail: Mail, drive: Folder };

export function ServiceIcon({ service, className = "h-5 w-5" }: { service: ServiceKey; className?: string }) {
  const Icon = icons[service];
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}
