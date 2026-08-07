# sku-regulator

**From a stubborn EU portal to compliant, multi-country product data.**

A founding-engineer demo. It scrapes the real EU Register of Nutrition &
Health Claims, normalises it into a Postgres + pgvector schema, and answers the
question every health brand asks: *"is this claim legal where I sell?"*

This repo is deliberately small, real, and end-to-end. Every number shown in
the UI is live from the running pipeline — nothing is mocked.

---

## Why this exists

Health & wellness products live and die on what you may print on the label.
In the EU, that's decided by **Regulation (EC) 1924/2006** and maintained in a
public register: ~2,300 claims like *"Vitamin C contributes to the normal
function of the immune system"*, each with conditions of use, an EFSA
scientific opinion, and an authorisation status.

The catch: the register is a JavaScript single-page app with a session-based,
paginated search. There is no public API, no clean bulk export. Someone has to
get the data out — and then keep it correct, because wrong data in regulated
products has real-world consequences.

That "someone" is what this pipeline is for.

## The pipeline (five steps)

```
01 INGEST    02 EXTRACT       03 STORE                 04 RETRIEVE      05 VERIFY
scrape the   flatten a        multi-country            hybrid search    human-in-the-loop
stubborn     hostile          Postgres + pgvector      + grounded       compliance
portal       value-tree       (FTS + embeddings)       answer           queue
```

| Step | What happens | How |
|---|---|---|
| **01 Ingest** | Pull the register from `ec.europa.eu` — the same data the web UI renders. | Reverse-engineered the FIP backend API: `GET /backend/api/policy-items?foodDomain=nut&authorisationType=nut_auth`. Real browser User-Agent, crawl-friendly. |
| **02 Extract** | The register returns a recursive "value tree". Flatten each claim into a clean record. | Deterministic parser walks `valueIdentifier` nodes → `claims.jsonl` + best-effort ingredient extraction. |
| **03 Store** | A claim is authorised in one market, not another. Model that. | Postgres 16 + pgvector. Schema: `products → skus → claims → ingredients → sources` + `country_status` pivot + `embedding` column (768-dim, `nomic-embed-text`, local Ollama). HNSW index. |
| **04 Retrieve** | Compliance questions mix exact wording with intent. | Reciprocal-rank fusion over Postgres FTS **and** pgvector cosine similarity. Every hit carries the EU register code, EFSA opinion, and per-country verdict. |
| **05 Verify** | Wrong data has consequences — so decisions are made by people. | Per-SKU compliance verdict + anomaly queue for low-confidence extractions and marketing-variant wording. |

## Repository layout

```
ingest/       fetch + parse the EU register (hostile portal)
store/        schema.sql, seed.py, demo_enrich.py
rag/          retrieve.py (hybrid FTS+vector), answer.py (LangChain + local LLM)
api/          FastAPI backend (stats, search, ask, anomalies, products)
web/          Next.js guided demo (pipeline theater, explore, portfolio)
docker-compose.yml   Postgres 16 + pgvector
```

## Run it

Prereqs: Docker, Python 3.11+, Node 20+, and [Ollama](https://ollama.com)
with `nomic-embed-text` and `llama3.2:3b` pulled.

```bash
# 1. Database (Postgres 16 + pgvector on port 55432)
docker compose up -d db

# 2. Python env + seed the register
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python ingest/fetch_eu_register.py   # optional: refetch from the live portal
python store/seed.py                 # creates schema, loads 2337 claims + embeddings
python store/demo_enrich.py          # demo SKUs + anomaly queue

# 3. API (port 8000)
uvicorn api.main:app --port 8000

# 4. Demo UI (port 3000)
cd web && npm install && npm run dev
```

Open <http://localhost:3000>. The **Pipeline** page walks each step; **Explore**
lets you ask the register in plain language; **Portfolio** shows SKU verdicts
and the human-in-the-loop queue.

## Notes on scope

- **One real source.** The EU register is the foundation. A production system
  would add national/UK registers and retailer requirements as additional
  `sources` — the schema already supports it.
- **Local-first AI.** Embeddings and the answer LLM run on local Ollama. No
  data leaves the machine, no API keys needed.
- **Not production.** This is a demo to show *how* the pipeline is built, not a
  compliance service. Extracted claims mirror the register; treat the demo
  products as illustrative.

---

*Built for the Kensai founding-engineer application. The thing that doesn't
exist yet — partially built.*
