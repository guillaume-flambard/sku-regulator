import type { ClaimStatus, CountryVerdict } from "@/lib/api";
import { CheckCircle, XCircle, MinusCircle, ShieldCheck } from "@phosphor-icons/react";

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const map: Record<ClaimStatus, { label: string; cls: string }> = {
    authorised: {
      label: "Authorised",
      cls: "bg-sage-soft text-sage border border-sage/20",
    },
    non_authorised: {
      label: "Non-authorised",
      cls: "bg-brick-tint text-brick border border-brick/20",
    },
    revoked: {
      label: "Revoked",
      cls: "bg-surface-container text-muted border border-line",
    },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status === "authorised" ? (
        <CheckCircle size={13} weight="fill" />
      ) : status === "revoked" ? (
        <MinusCircle size={13} weight="fill" />
      ) : (
        <XCircle size={13} weight="fill" />
      )}
      {label}
    </span>
  );
}

export function CountryBadge({ verdict }: { verdict: CountryVerdict | undefined }) {
  if (!verdict) return null;
  const map: Record<CountryVerdict, { label: string; cls: string; icon: "ok" | "no" }> = {
    allowed: { label: "Allowed here", cls: "text-sage bg-sage-soft border border-sage/20", icon: "ok" },
    restricted: { label: "Restricted", cls: "text-amber bg-amber-tint border border-amber/20", icon: "no" },
    not_allowed: { label: "Not allowed", cls: "text-brick bg-brick-tint border border-brick/20", icon: "no" },
  };
  const { label, cls, icon } = map[verdict];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {icon === "ok" ? <ShieldCheck size={13} weight="fill" /> : <XCircle size={13} weight="fill" />}
      {label}
    </span>
  );
}

export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "bg-sage" : pct >= 70 ? "bg-amber" : "bg-brick";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-data-mono text-xs text-muted">{pct}%</span>
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-label-eyebrow text-label-eyebrow text-muted uppercase tracking-widest">{children}</div>
  );
}
