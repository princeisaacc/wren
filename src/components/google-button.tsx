"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleIcon } from "@/components/google-icon";
import { authMessage, useAuth } from "@/components/auth-context";

export function GoogleButton({ className = "" }: { className?: string }) {
  const { logInWithGoogle, configured } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const click = async () => {
    setError("");
    if (!configured) {
      setError("Sign-in is not set up yet. Add the Firebase keys to .env.local and restart.");
      return;
    }
    setBusy(true);
    try {
      const { isNew } = await logInWithGoogle();
      router.push(isNew ? "/onboarding" : "/chat");
    } catch (err) {
      setError(authMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button type="button" className="btn btn-secondary w-full" onClick={click} disabled={busy}>
        <GoogleIcon />
        {busy ? "Opening Google..." : "Continue with Google"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
