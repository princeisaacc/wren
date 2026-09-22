"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Field } from "@/components/field";
import { GoogleButton } from "@/components/google-button";
import { authCode, authMessage, useAuth } from "@/components/auth-context";

type Mode = "login" | "reset" | "sent";

export default function LoginPage() {
  const router = useRouter();
  const { logIn, resetPassword, configured } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const validEmail = /^\S+@\S+\.\S+$/.test(email);
  const notSetUp = "Sign-in is not set up yet. Add the Firebase keys to .env.local and restart.";

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const next: typeof error = {};
    if (!validEmail) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setError(next);
    if (Object.keys(next).length) return;
    if (!configured) return setFormError(notSetUp);
    setBusy(true);
    try {
      await logIn(email.trim(), password);
      router.push("/chat");
    } catch (err) {
      setFormError(authMessage(err));
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!validEmail) return setError({ email: "Enter a valid email address." });
    setError({});
    if (!configured) return setFormError(notSetUp);
    setBusy(true);
    try {
      await resetPassword(email.trim());
    } catch (err) {
      // Do not reveal whether an account exists for this email.
      if (authCode(err) !== "auth/user-not-found") {
        setFormError(authMessage(err));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setMode("sent");
  };

  if (mode === "sent") {
    return (
      <AuthLayout title="Check your email" back="/login">
        <div className="card flex gap-3 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <p className="text-sm text-muted">
            If an account exists for {email}, a reset link is on its way. Check your spam folder if you do not see it.
          </p>
        </div>
        <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setMode("login")}>
          Back to log in
        </button>
      </AuthLayout>
    );
  }

  if (mode === "reset") {
    return (
      <AuthLayout title="Reset your password" subtitle="Enter your email and we will send you a link to choose a new password.">
        <form onSubmit={reset} noValidate className="space-y-4">
          <Field label="Email address" error={error.email}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="email" className="input" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} />
            )}
          </Field>
          {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Sending..." : "Send reset link"}
          </button>
          <button type="button" className="btn btn-secondary w-full" onClick={() => { setFormError(""); setMode("login"); }}>Back to log in</button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back.">
      <form onSubmit={login} noValidate className="space-y-4">
        <Field label="Email address" error={error.email}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="email" className="input" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Password" error={error.password}>
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <input id={id} type={show ? "text" : "password"} className="input pr-11" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-sub hover:bg-softer">
                {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          )}
        </Field>
        <div className="text-right">
          <button type="button" className="text-sm font-medium text-brand hover:underline" onClick={() => { setFormError(""); setMode("reset"); }}>
            Forgot password?
          </button>
        </div>
        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-sub" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton />

      <p className="mt-6 text-center text-sm text-sub">
        New to Wren?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
