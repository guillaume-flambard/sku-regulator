"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  XCircle,
  Flag,
  Check,
  Package,
  MapPin,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";

import { api, type Anomaly, type Product } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { Eyebrow, Confidence } from "@/components/badges";

export default function Portfolio() {
  const [products, setProducts] = useState<Product[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [country, setCountry] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; label: string } | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.products(), api.anomalies()])
      .then(([p, a]) => {
        setProducts(p.products);
        setAnomalies(a.anomalies);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load portfolio"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = country ? products.filter((p) => p.country_code === country) : products;

  const resolve = useCallback(async (id: number) => {
    setResolving(id);
    setError(null);
    const removed = anomalies.find((x) => x.id === id);
    // optimistic: remove now, restore on error or undo
    setAnomalies((a) => a.filter((x) => x.id !== id));
    setToast({ id, label: "Anomaly resolved" });
    try {
      await api.resolveAnomaly(id);
    } catch (e) {
      if (removed) setAnomalies((a) => [removed, ...a]);
      setError(e instanceof Error ? e.message : "Could not resolve the anomaly");
    } finally {
      setResolving(null);
    }
  }, [anomalies]);

  const undo = useCallback(async (id: number) => {
    setToast(null);
    setError(null);
    try {
      await api.undoAnomaly(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo");
    }
    // refresh both lists so the UI matches the DB
    const [p, a] = await Promise.all([api.products(), api.anomalies()]);
    setProducts(p.products);
    setAnomalies(a.anomalies);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-mist">
      <SiteHeader />

      <main className="mx-auto max-w-container-max px-gutter py-12">
        <Eyebrow>Compliance portfolio</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Your SKUs, checked against the register
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Six demo products across four markets, each linked to real authorised
          claims. Anything at risk lands in the human-in-the-loop queue below.
        </p>

        {/* filter */}
        <div className="mt-8 flex items-center gap-2">
          {["", "FR", "DE", "ES", "GB"].map((c) => (
            <button
              key={c || "all"}
              onClick={() => setCountry(c)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                country === c
                  ? "border-sage bg-sage-soft text-sage"
                  : "border-line bg-white text-muted hover:border-sage/30"
              }`}
            >
              {c || "All markets"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border border-line bg-white" />
            ))}
          </div>
        ) : error && products.length === 0 ? (
          <div role="alert" className="mt-8 flex items-center gap-3 rounded-xl border border-danger/30 bg-[#fbeae6] px-4 py-3 text-sm text-danger">
            <span className="flex-1">{error} — check that the pipeline API on :8000 is running.</span>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full border border-danger/40 bg-white px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5"
            >
              Reload
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <div key={p.sku} className="rounded-xl border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-soft text-sage">
                      <Package size={20} weight="duotone" />
                    </div>
                    <div>
                      <div className="font-semibold leading-tight">{p.name}</div>
                      <div className="text-xs text-muted">{p.brand}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 font-data-mono text-xs text-muted">
                  <MapPin size={12} /> {p.country_code} · {p.sku}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    {p.non_compliant > 0 || p.review > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fbeae6] px-2.5 py-0.5 text-xs font-medium text-danger">
                        <XCircle size={13} weight="fill" /> Needs review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-medium text-sage">
                        <ShieldCheck size={13} weight="fill" /> Compliant
                      </span>
                    )}
                  </div>
                  {p.confidence != null && <Confidence value={p.confidence} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* anomaly queue */}
        <div className="mt-16">
          <div className="flex items-center gap-2">
            <Flag size={20} className="text-warning" weight="duotone" />
            <h2 className="text-xl font-semibold tracking-tight">Human-in-the-loop queue</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Low-confidence extractions and wording that drifts from the authorised
            text are held for a person to decide — never auto-released on a
            regulated label.
          </p>

          {anomalies.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-muted">
              Queue clear. No open anomalies.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {anomalies.map((a) => (
                <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      a.severity === "high" ? "bg-[#fbeae6] text-danger" : a.severity === "medium" ? "bg-[#fbf1df] text-warning" : "bg-sage-soft text-sage"
                    }`}
                  >
                    <Flag size={16} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{a.product_name ?? a.product_sku ?? "Unknown product"}</span>
                      {a.claim_code && (
                        <code className="rounded bg-sage-soft px-1.5 py-0.5 font-data-mono text-xs text-sage">{a.claim_code}</code>
                      )}
                      <span className="rounded-full bg-line px-2 py-0.5 font-data-mono text-[10px] uppercase tracking-wider text-ink/80">
                        {a.severity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{a.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => resolve(a.id)}
                      disabled={resolving === a.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition-transform hover:-translate-y-px disabled:opacity-60"
                    >
                      <Check size={14} /> {resolving === a.id ? "Resolving…" : "Resolve"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* undo toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
            <span>{toast.label}</span>
            <button
              onClick={() => undo(toast.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-background/30 px-3 py-1 text-xs font-medium transition-colors hover:bg-mist/10"
            >
              <ArrowCounterClockwise size={13} /> Undo
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
