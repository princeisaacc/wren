import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
