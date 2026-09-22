import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <Logo />
      <p className="mt-10 text-sm text-sub">Error 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-sub">This page does not exist or has moved.</p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href="/chat" className="btn btn-primary">Go to Chat</Link>
        <Link href="/" className="btn btn-secondary">Go to Welcome</Link>
      </div>
    </div>
  );
}
