"use client";

import { useState } from "react";
import { Field } from "@/components/field";
import { brand } from "@/lib/brand";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; message?: string }>({});
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (!message.trim()) next.message = "Write a message.";
    setErrors(next);
    if (Object.keys(next).length) return;
    // Later: send this through an API route.
    setSent(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-2 text-sm text-sub">
        Questions, feedback or a problem with {brand.name}? Write to{" "}
        <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand hover:underline">{brand.supportEmail}</a>{" "}
        or use the form. We usually reply within 24 hours.
      </p>

      {sent ? (
        <div className="card mt-6 p-4 text-sm" role="status">
          <p className="font-medium">Message sent</p>
          <p className="mt-1 text-sub">We will reply to {email}.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <Field label="Your name">
            {({ id }) => <input id={id} className="input" autoComplete="name" />}
          </Field>
          <Field label="Email address" error={errors.email}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="email" className="input" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} />
            )}
          </Field>
          <Field label="Message" error={errors.message}>
            {({ id, describedBy, invalid }) => (
              <textarea id={id} rows={5} className="input h-auto py-2" value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} />
            )}
          </Field>
          <button type="submit" className="btn btn-primary w-full sm:w-auto">Send message</button>
        </form>
      )}
    </div>
  );
}
