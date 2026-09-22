"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Field } from "@/components/field";
import { GoogleButton } from "@/components/google-button";
import { authCode, authMessage, useAuth } from "@/components/auth-context";

type Errors = { name?: string; email?: string; password?: string };

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, configured } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!configured) {
      setFormError("Sign-in is not set up yet. Add the Firebase keys to .env.local and restart.");
      return;
    }
    setBusy(true);
    try {
      await signUp(name.trim(), email.trim(), password);
      router.push("/onboarding");
    } catch (err) {
      const message = authMessage(err);
      if (authCode(err) === "auth/email-already-in-use") setErrors({ email: message });
      else setFormError(message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Connecting Google services is optional and happens later.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Full name" error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <input id={id} className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Email address" error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="email" className="input" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters.">
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <input id={id} type={show ? "text" : "password"} className="input pr-11" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-sub hover:bg-softer">
                {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          )}
        </Field>
        {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-sub" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton />

      <p className="mt-6 text-center text-sm text-sub">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  );
}
