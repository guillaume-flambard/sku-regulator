"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  CloudArrowDown,
  FileCsv,
  Database,
  MagnifyingGlass,
  ShieldCheck,
  TerminalWindow,
  CircleNotch,
  Globe,
  BoundingBox,
  Rows,
  ListChecks,
} from "@phosphor-icons/react";

import type { Stats } from "@/lib/api";import { Eyebrow } from "@/components/badges";

const STAGES = [
  {
    id: "ingest",
    n: "01",
    title: "Ingest",
    tag: "Scrape the stubborn portal",
    icon: TerminalWindow,
    what:
      "We hit the EU Register of Nutrition & Health Claims — the same public portal the web UI uses. It's a JS single-page app with a paginated, session-based search: no public API, no bulk export from the UI.",
    how: "Reverse-engineered the network calls to find the FIP backend API (policy-items?foodDomain=nut&authorisationType=nut_auth), then fetched it with a real browser User-Agent and crawl-friendly pacing.",
    result: "2,337 policy items · 21 MB of raw JSON pulled from ec.europa.eu",
  },
  {
    id: "extract",
    n: "02",
    title: "Extract",
    tag: "Flatten a hostile value-tree",
    icon: BoundingBox,
    what:
      "The register returns a recursive, generic 'value tree' — every field is just a valueIdentifier. Claim text, health relationship, EFSA opinion, legislation and conditions of use are buried at arbitrary depth.",
    how: "A deterministic parser walks the tree, reads valueIdentifiers, and flattens each claim into a clean record — plus a best-effort ingredient extraction so we can join claims to real substances.",
    result: "2,337 clean claim records → claims.jsonl, ready for a schema",
  },
  {
    id: "store",
    n: "03",
    title: "Store",
    tag: "Multi-country Postgres + pgvector",
    icon: Database,
    what:
      "A single claim can be authorised in one market and not another. So the schema models products → SKUs → claims → ingredients → sources, plus a country_status pivot table and a pgvector column for semantic search.",
    how: "Postgres 16 + pgvector 0.8. HNSW index over nomic-embed-text embeddings (768-dim, local Ollama). A migration for every shape, seeded from the parsed register.",
    result: "65,436 country_status rows · 7,196 sources · 768-dim embeddings",
  },
  {
    id: "rag",
    n: "04",
    title: "Retrieve",
    tag: "Hybrid full-text + semantic search",
    icon: MagnifyingGlass,
    what:
      "Compliance questions mix exact wording ('the claim may be used only for food which contains 1g...') with intent ('can I say this boosts immunity?'). One search engine can't do both well.",
    how: "Reciprocal-rank fusion over Postgres full-text search AND pgvector cosine similarity. Each hit carries the EU register code, EFSA opinion and a per-country verdict.",
    result: "Ask a question in plain language → grounded, cited answers",
  },
  {
    id: "verify",
    n: "05",
    title: "Verify",
    tag: "Human-in-the-loop compliance",
    icon: ShieldCheck,
    what:
      "Wrong data in regulated products has real-world consequences. So the pipeline ends where decisions get made: a compliance verdict per SKU, with an anomaly queue for low-confidence extractions and marketing-variant wording.",
    how: "Every product-claim link carries a verdict + confidence. Anything below threshold, or wording that drifts from the authorised text, lands in a queue for a human to resolve.",
    result: "Demo SKUs with compliant / at-risk verdicts · anomaly queue",
  },
] as const;

function StagePanel({
  stage,
  stats,
}: {
  stage: (typeof STAGES)[number];
  stats: Stats | null;
}) {
  const Icon = stage.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent">
          <Icon size={22} weight="duotone" />
        </div>
        <div>
          <div className="font-mono text-xs tracking-widest text-muted">{stage.n}</div>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">{stage.title}</h2>
          <p className="text-sm font-medium text-accent">{stage.tag}</p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            What this step does
          </h3>
          <p className="text-[15px] leading-relaxed text-foreground/90">{stage.what}</p>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            How it&apos;s built
          </h3>
          <p className="text-[15px] leading-relaxed text-foreground/90">{stage.how}</p>
        </div>
        <div className="flex items-center gap-2 border-t border-line pt-3">
          <CircleNotch size={15} className="text-accent" weight="bold" />
          <p className="font-mono text-sm text-accent">{stage.result}</p>
        </div>
      </div>

      {stage.id === "ingest" && stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Claims scraped" value={stats.claims.toLocaleString("en-US")} />
          <StatCard label="Authorised" value={stats.authorised.toLocaleString("en-US")} />
          <StatCard label="Non-authorised" value={stats.non_authorised.toLocaleString("en-US")} />
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="font-mono text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

export default function Home({ stats }: { stats: Stats | null }) {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];

  return (
    <div className="min-h-[100dvh]">
      {/* Hero */}
      <header className="border-b border-line bg-white/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
              <ShieldCheck size={16} weight="fill" />
            </div>
            <span className="font-semibold tracking-tight">sku-regulator</span>
            <span className="hidden text-sm text-muted sm:inline">· EU health-claims intelligence</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted">
            <a href="#pipeline" className="hover:text-foreground">Pipeline</a>
            <a href="/explore" className="hover:text-foreground">Explore</a>
            <a href="/portfolio" className="hover:text-foreground">Portfolio</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <Eyebrow>A founding-engineer demo</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tighter md:text-6xl">
          From a stubborn EU portal to{" "}
          <span className="italic text-accent">compliant, multi-country</span> product data.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          The EU health-claims register decides what you may write on a supplement
          label. This pipeline scrapes it, normalises it, embeds it, and answers
          the question brands actually ask — <em>“is this claim legal where I sell?”</em>
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#pipeline"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-px"
          >
            Watch the pipeline <ArrowRight size={16} />
          </a>
          <a
            href="/explore"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-medium hover:border-foreground/30"
          >
            Try a compliance question
          </a>
        </div>
      </section>

      {/* Pipeline theater */}
      <section id="pipeline" className="border-t border-line bg-background">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="mb-12 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <Eyebrow>The pipeline</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Five steps. Real data. Nothing hidden.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Walk each stage like a product demo. Every number below is live from
              the running pipeline — not mocked.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-[260px_1fr]">
            {/* stage rail */}
            <nav aria-label="Pipeline stages" className="flex gap-2 overflow-x-auto md:flex-col">
              {STAGES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActive(i)}
                  className={`group flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    i === active
                      ? "border-accent/40 bg-accent-soft text-foreground"
                      : "border-line bg-white text-muted hover:border-accent/30"
                  }`}
                >
                  <span className="font-mono text-xs text-accent">{s.n}</span>
                  <span className="text-sm font-medium">{s.title}</span>
                  {i === active && <ArrowRight size={14} className="ml-auto text-accent" />}
                </button>
              ))}
            </nav>

            {/* stage detail */}
            <StagePanel stage={stage} stats={stats} />
          </div>
        </div>
      </section>

      {/* Stripe row */}
      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-10 text-sm text-muted">
          <span className="inline-flex items-center gap-2"><CloudArrowDown size={16} /> Live EU fetch</span>
          <span className="inline-flex items-center gap-2"><FileCsv size={16} /> 2,337 parsed claims</span>
          <span className="inline-flex items-center gap-2"><Database size={16} /> Postgres + pgvector</span>
          <span className="inline-flex items-center gap-2"><Globe size={16} /> 28 markets</span>
          <span className="inline-flex items-center gap-2"><Rows size={16} /> 65,436 country rows</span>
          <span className="inline-flex items-center gap-2"><ListChecks size={16} /> Human-in-the-loop</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>sku-regulator — demo for Kensai · founding engineer</span>
          <span className="font-mono text-xs">pipelines in <a href="/explore" className="underline decoration-accent/40 underline-offset-2 hover:text-foreground">/explore</a> and <a href="/portfolio" className="underline decoration-accent/40 underline-offset-2 hover:text-foreground">/portfolio</a></span>
        </div>
      </footer>
    </div>
  );
}
