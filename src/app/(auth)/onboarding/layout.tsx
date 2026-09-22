import { RequireAuth } from "@/components/auth-context";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
