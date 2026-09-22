import { brand } from "@/lib/brand";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-brand text-onbrand"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 7h.01" />
        <path d="M3.4 18c3.6 0 6.6-2 9-6 3-1 6-3 8-7-3.5 0-6.2 1.5-8.4 3.8C9.6 11.2 6.8 14 3.4 18z" />
        <path d="m14 11-4 4" />
      </svg>
    </span>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight text-ink">{brand.name}</span>
    </span>
  );
}