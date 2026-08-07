"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  MagnifyingGlass,
  ArrowRight,
  ArrowLeft,
  Sparkle,
  Globe,
  Hash,
  Paperclip,
  CircleNotch,
} from "@phosphor-icons/react";

import { api, type ClaimResult, type AskResult, type CountryVerdict } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge, CountryBadge, Eyebrow } from "@/components/badges";
import { EuMap } from "@/components/eu-map";

const EXAMPLES = [
  { q: "Can I say vitamin C supports the immune system?", country: "FR" },
  { q: "Is a DHA brain claim allowed in Germany?", country: "DE" },
  { q: "What claims can a glucomannan slimming product make?", country: "ES" },
];

type View = "results" | "answer";

/** Map the selected market to the active claim's verdict for the EU map. */
function countryVerdicts(
  activeCode: string,
  results: ClaimResult[],
  country: string,
): Record<string, CountryVerdict> {
  const active = results.find((r) => r.policy_item_code === activeCode);
  if (!active?.country_status) return {};
  return { [country]: active.country_status };
}

export default function Explore() {
  const [query, setQuery] = useState(EXAMPLES[0].q);
  const [country, setCountry] = useState("FR");
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [ask, setAsk] = useState<AskResult | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [view, setView] = useState<View>("results");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string, c: string) => {
    setLoading(true);
    setError(null);
    setAsk(null);
    setActiveCode(null);
    try {
      const r = await api.search(q, c, 5);
      setResults(r.results);
      setActiveCode(r.results[0]?.policy_item_code ?? null);
      setView("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch on mount is a legitimate external-system sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch(EXAMPLES[0].q, "FR");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) runSearch(query, country);
  };

  const loadAnswer = useCallback(async () => {
    if (ask) {
      setView("answer");
      return;
    }
    setAskLoading(true);
    setError(null);
    try {
      const a = await api.ask(query, country);
      setAsk(a);
      setView("answer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate an answer");
    } finally {
      setAskLoading(false);
    }
  }, [ask, query, country]);

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <Eyebrow>Ask the register</Eyebrow>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          &ldquo;Can I put this on the label?&rdquo;
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Ask in plain language. The answer is grounded in the real EU register,
          with the sources and the per-market verdict shown — not a model hallucination.
        </p>

        {/* search bar */}
        <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Can I say vitamin C supports immunity?"
              className="w-full rounded-full border border-line bg-white py-3 pl-11 pr-4 text-[15px] outline-none focus:border-sage focus:ring-2 focus:ring-sage/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="Target country"
              className="rounded-full border border-line bg-white px-4 py-3 text-sm outline-none focus:border-sage"
            >
              <option value="FR">🇫🇷 FR</option>
              <option value="DE">🇩🇪 DE</option>
              <option value="ES">🇪🇸 ES</option>
              <option value="GB">🇬🇧 GB</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? <CircleNotch size={16} className="animate-spin" /> : <Sparkle size={16} />}
              Ask
            </button>
          </div>
        </form>

        {/* example chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.q}
              onClick={() => { setQuery(ex.q); setCountry(ex.country); runSearch(ex.q, ex.country); }}
              className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs text-muted transition-colors hover:border-sage/40 hover:text-ink"
            >
              {ex.q}
            </button>
          ))}
        </div>

        {/* error inline, next to the action */}
        {error && (
          <div role="alert" className="mt-4 flex items-center gap-3 rounded-xl border border-danger/30 bg-[#fbeae6] px-4 py-3 text-sm text-danger">
            <span className="flex-1">The query failed. Check that the pipeline API is reachable, then try again.</span>
            <button
              onClick={() => submit()}
              className="rounded-full border border-danger/40 bg-white px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5"
            >
              Retry
            </button>
          </div>
        )}

        {/* results + map */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* left: results / answer */}
          <div>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-white" />
                ))}
              </div>
            ) : !error && results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-soft text-sage">
                  <MagnifyingGlass size={22} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">No claim matched “{query}”</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  The register only covers authorised health-claims wording. Try
                  rewording, picking one of the examples, or searching an ingredient
                  like “vitamin C” or “DHA”.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {EXAMPLES.slice(0, 2).map((ex) => (
                    <button
                      key={ex.q}
                      onClick={() => { setQuery(ex.q); setCountry(ex.country); runSearch(ex.q, ex.country); }}
                      className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs text-muted transition-colors hover:border-sage/40 hover:text-ink"
                    >
                      {ex.q}
                    </button>
                  ))}
                </div>
              </div>
            ) : view === "results" && results.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Top matches for “{query}” in {country}</span>
                  <button
                    onClick={loadAnswer}
                    disabled={askLoading}
                    className="inline-flex items-center gap-1 text-sm font-medium text-sage hover:underline disabled:opacity-60"
                  >
                    {askLoading ? <CircleNotch size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    {askLoading ? "Answering…" : "Read the grounded answer"}
                  </button>
                </div>
                {results.map((r) => (
                  <ResultCard
                    key={r.policy_item_code}
                    r={r}
                    active={r.policy_item_code === activeCode}
                    onSelect={() => setActiveCode(r.policy_item_code)}
                  />
                ))}
              </div>
            ) : ask && view === "answer" ? (
              <AnswerCard key={ask.answer} ask={ask} onBack={() => setView("results")} />
            ) : null}
          </div>

          {/* right: map */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Globe size={16} className="text-sage" /> Market view
                </div>
                <span className="font-mono text-xs text-muted">{country}</span>
              </div>
              <div className="mt-3">
                <EuMap
                  verdicts={activeCode ? countryVerdicts(activeCode, results, country) : {}}
                  activeCode={country}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                How the highlighted claim is treated in the selected market. Click a
                match to switch which claim the map reflects.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ResultCard({
  r,
  active,
  onSelect,
}: {
  r: ClaimResult;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-shadow ${
        active ? "border-sage/50 bg-sage-soft/40 shadow-sm" : "border-line bg-white hover:border-sage/30 hover:shadow-sm"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-sage-soft px-2 py-0.5 font-mono text-xs text-sage">
          {r.policy_item_code}
        </code>
        <StatusBadge status={r.status} />
        <CountryBadge verdict={r.country_status} />
        <span className="ml-auto font-mono text-xs text-muted">
          {r.claim_type ?? "—"}
        </span>
      </div>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink/90">{r.claim_text}</p>
      {r.matches && (
        <div className="mt-3 flex items-center gap-4 border-t border-line pt-2.5 font-mono text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Hash size={12} /> fts {r.matches.fts?.toFixed(2) ?? "—"}</span>
          <span className="inline-flex items-center gap-1"><Paperclip size={12} /> vec {r.matches.vector?.toFixed(2) ?? "—"}</span>
        </div>
      )}
    </button>
  );
}

function AnswerCard({ ask, onBack }: { ask: AskResult; onBack: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const words = useMemo(() => ask.answer.split(" "), [ask.answer]);
  useEffect(() => {
    const t = setInterval(() => {
      setRevealed((n) => {
        if (n >= words.length) {
          clearInterval(t);
          return n;
        }
        return n + 3;
      });
    }, 45);
    return () => clearInterval(t);
  }, [words.length]);

  const shown = words.slice(0, revealed).join(" ");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-sage/25 bg-white">
      <div className="border-b border-line p-4">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={14} /> Back to matches
        </button>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
            <Sparkle size={14} weight="fill" />
          </div>
          <p className="text-[15px] leading-relaxed text-ink/90">
            {shown}
            {revealed < words.length && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sage align-middle" />
            )}
          </p>
        </div>
      </div>
      <div className="border-t border-line p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Sources</div>
        <div className="space-y-2">
          {ask.sources.map((s) => (
            <div key={s.policy_item_code} className="flex items-center gap-2 text-sm">
              <code className="rounded bg-sage-soft px-1.5 py-0.5 font-mono text-xs text-sage">{s.policy_item_code}</code>
              <StatusBadge status={s.status} />
              <span className="text-xs text-muted">{s.claim_text.slice(0, 60)}…</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
