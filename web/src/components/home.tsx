"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  TerminalWindow,
  BoundingBox,
  Database,
  MagnifyingGlass,
  ShieldCheck,
  CircleNotch,
} from "@phosphor-icons/react";

import type { Stats } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { Eyebrow } from "@/components/badges";

const STAGES = [
  {
    id: "ingest",
    n: "01",
    title: "Ingest",
    icon: TerminalWindow,
    what: "Pull the register from the EU Food & Feed portal — the same data the official web UI renders. A JavaScript single-page app with session-based search and no public API.",
    how: "Reverse-engineered the FIP backend API (policy-items?foodDomain=nut&authorisationType=nut_auth), then fetched it with a real browser User-Agent and crawl-friendly pacing.",
    result: "2,337 policy items · 21 MB of raw JSON pulled from ec.europa.eu",
  },
  {
    id: "extract",
    n: "02",
    title: "Extract",
    icon: BoundingBox,
    what: "The register returns a recursive 'value tree' — every field is just a valueIdentifier. Claim text, health relationship, EFSA opinion and conditions are buried at arbitrary depth.",
    how: "A deterministic parser walks the tree, reads valueIdentifiers, and flattens each claim into a clean record, plus a best-effort ingredient extraction.",
    result: "2,337 clean claim records → claims.jsonl, ready for a schema",
  },
  {
    id: "store",
    n: "03",
    title: "Store",
    icon: Database,
    what: "A claim is authorised in one market and not another. So the schema models products → SKUs → claims → ingredients → sources, plus a country_status pivot and pgvector.",
    how: "Postgres 16 + pgvector. HNSW index over nomic-embed-text embeddings (768-dim, local Ollama). A migration per shape, seeded from the parsed register.",
    result: "65,436 country_status rows · 7,196 sources · 768-dim embeddings",
  },
  {
    id: "rag",
    n: "04",
    title: "Retrieve",
    icon: MagnifyingGlass,
    what: "Compliance questions mix exact wording with intent. One search engine can't do both well — full-text finds the legal phrasing, semantic finds the meaning.",
    how: "Reciprocal-rank fusion over Postgres full-text search AND pgvector cosine similarity. Every hit carries the EU register code, EFSA opinion and a per-country verdict.",
    result: "Ask a question in plain language → grounded, cited answers",
  },
  {
    id: "verify",
    n: "05",
    title: "Verify",
    icon: ShieldCheck,
    what: "Wrong data in regulated products has real-world consequences. So the pipeline ends where decisions get made: a compliance verdict per SKU, with an anomaly queue.",
    how: "Every product-claim link carries a verdict + confidence. Anything below threshold, or wording that drifts from the authorised text, lands in a queue for a human.",
    result: "Demo SKUs with compliant / at-risk verdicts · anomaly queue",
  },
] as const;

export default function Home({ stats }: { stats: Stats | null }) {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];
  const Icon = stage.icon;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />

      <main className="flex-grow pb-24">
        {/* Hero */}
        <section className="mx-auto max-w-container-max px-gutter pt-24 pb-16">
          <div className="max-w-3xl">
            <Eyebrow>A founding-engineer demo</Eyebrow>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink md:text-6xl">
              From a stubborn EU portal to{" "}
              <span className="text-sage">compliant, multi-country</span> product data.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              The EU health-claims register decides what you may write on a
              supplement label. This pipeline scrapes it, normalises it, embeds
              it, and answers the question brands actually ask — is this claim
              legal where I sell?
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 rounded-full bg-sage px-6 py-3 text-body-sm font-semibold text-white transition-transform hover:-translate-y-px active:scale-95"
              >
                Watch the pipeline <ArrowRight size={16} />
              </a>
              <a
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-transparent px-6 py-3 text-body-sm font-semibold text-ink transition-colors hover:border-outline active:scale-95"
              >
                Try a compliance question
              </a>
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section id="pipeline" className="mx-auto max-w-container-max px-gutter pb-16">
          <div className="mb-10 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <Eyebrow>The pipeline</Eyebrow>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">
                Five steps. Real data. Nothing hidden.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Walk each stage like a product demo. Every number below is live
              from the running pipeline — not mocked.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Stepper */}
            <div className="flex flex-col gap-2 md:col-span-4">
              {STAGES.map((s, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(i)}
                    className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
                      isActive
                        ? "relative overflow-hidden border-sage/20 bg-sage-soft"
                        : "cursor-pointer border-line bg-white hover:border-outline"
                    }`}
                  >
                    {isActive && <div className="absolute inset-y-0 left-0 w-1 bg-sage" />}
                    <span className={`font-data-mono text-sm mt-1 ${isActive ? "text-sage" : "text-muted"}`}>
                      {s.n}
                    </span>
                    <div>
                      <h3 className={`font-body-base font-semibold ${isActive ? "text-sage" : "text-ink"}`}>
                        {s.title}
                      </h3>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="flex flex-col gap-6 md:col-span-8">
              {stage.id === "ingest" && stats && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-4">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-muted">Claims scraped</span>
                    <div className="font-data-mono text-2xl text-ink">
                      {stats.claims.toLocaleString("en-US")}
                      <span className="ml-1 text-sm text-muted">claims</span>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-4">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-muted">Authorised</span>
                    <span className="mt-auto inline-flex w-max items-center gap-1 rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-sage">
                      {stats.authorised.toLocaleString("en-US")}
                    </span>
                  </div>
                  <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-4">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-muted">Non-authorised</span>
                    <span className="mt-auto inline-flex w-max items-center gap-1 rounded-full bg-brick-tint px-3 py-1 text-xs font-semibold text-brick">
                      {stats.non_authorised.toLocaleString("en-US")}
                    </span>
                  </div>
                </div>
              )}

              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col rounded-xl border border-line bg-white p-6 md:p-8"
              >
                <div className="mb-6 flex items-start gap-3 border-b border-line pb-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-soft text-sage">
                    <Icon size={22} weight="duotone" />
                  </div>
                  <div>
                    <div className="font-data-mono text-xs text-muted">{stage.n}</div>
                    <h3 className="text-lg font-semibold text-ink">{stage.title}</h3>
                  </div>
                </div>
                <div className="mb-6">
                  <h4 className="mb-2 text-sm font-semibold text-ink">What this step does</h4>
                  <p className="text-sm leading-relaxed text-muted">{stage.what}</p>
                </div>
                <div className="mb-6">
                  <h4 className="mb-2 text-sm font-semibold text-ink">How it&apos;s built</h4>
                  <p className="text-sm leading-relaxed text-muted">{stage.how}</p>
                </div>
                <div className="mt-auto flex items-center gap-2 border-t border-line pt-4">
                  <CircleNotch size={15} className="text-sage" weight="bold" />
                  <p className="font-data-mono text-xs text-sage">{stage.result}</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto w-full border-t border-line bg-mist">
        <div className="mx-auto flex max-w-container-max flex-col items-center justify-between gap-4 px-gutter py-4 md:flex-row">
          <div className="text-center text-xs opacity-80 md:text-left">
            © sku-regulator intelligence · Postgres + pgvector · 28 markets · 65,436 country rows ·
            human-in-the-loop
          </div>
          <div className="flex gap-4 text-xs">
            <a href="/explore" className="text-muted underline transition-colors hover:text-primary">
              Explore
            </a>
            <a href="/portfolio" className="text-muted underline transition-colors hover:text-primary">
              Portfolio
            </a>
            <a href="/graph" className="text-muted underline transition-colors hover:text-primary">
              Graph
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
