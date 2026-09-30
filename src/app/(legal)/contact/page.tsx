"use client";

import { useState } from "react";
import { Field } from "@/components/field";
import { brand } from "@/lib/brand";

export default function ContactPage() {
  const [opened, setOpened] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; message?: string }>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (!message.trim()) next.message = "Write a message.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const subject = `${brand.name} contact form${name ? ` — ${name}` : ""}`;
    const body = `${message}\n\n—\nFrom: ${name || "(no name given)"} <${email}>`;
    window.location.href = `mailto:${brand.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOpened(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-2 text-sm text-sub">
        Questions, feedback or a problem with {brand.name}? Write to{" "}
        <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand hover:underline">{brand.supportEmail}</a>{" "}
        directly, or fill in the form below and we&apos;ll open it for you, ready to send.
      </p>

      {opened ? (
        <div className="card mt-6 p-4 text-sm" role="status">
          <p className="font-medium">Your email app should now be open</p>
          <p className="mt-1 text-sub">
            It&apos;s addressed to {brand.supportEmail} with your message already filled in — just hit send from there. If nothing
            opened, email us directly at {brand.supportEmail}.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <Field label="Your name">
            {({ id }) => <input id={id} className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
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