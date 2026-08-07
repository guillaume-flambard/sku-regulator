import type { ClaimStatus, CountryVerdict } from "@/lib/api";
import { CheckCircle, XCircle, MinusCircle, ShieldCheck } from "@phosphor-icons/react";

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const map: Record<ClaimStatus, { label: string; cls: string }> = {
    authorised: {
      label: "Authorised",
      cls: "bg-accent-soft text-accent border border-accent/20",
    },
    non_authorised: {
      label: "Non-authorised",
      cls: "bg-[#fbeae6] text-danger border border-danger/20",
    },
    revoked: {
      label: "Revoked",
      cls: "bg-stone-100 text-muted border border-line",
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
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
    allowed: { label: "Allowed here", cls: "text-accent bg-accent-soft border border-accent/20", icon: "ok" },
    restricted: { label: "Restricted", cls: "text-warning bg-[#fbf1df] border border-warning/20", icon: "no" },
    not_allowed: { label: "Not allowed", cls: "text-danger bg-[#fbeae6] border border-danger/20", icon: "no" },
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
  const color = pct >= 90 ? "bg-accent" : pct >= 70 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-muted">{pct}%</span>
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-[0.18em] text-accent">{children}</div>
  );
}
