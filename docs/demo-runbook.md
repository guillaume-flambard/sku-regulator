# Demo runbook — sku-regulator

A 6-minute scripted walkthrough. Follow in order; every number is live from the
pipeline. This doubles as the Loom script and the on-call demo flow.

## Before you start (2 min)

1. `bash scripts/demo.sh` — boots everything (db + api + web).
2. `bash scripts/healthcheck.sh` — confirms every layer is green.
3. Pre-warm the grounded answer so the LLM isn't cold:
   ```bash
   curl -s -X POST http://127.0.0.1:8000/api/ask \
     -H "Content-Type: application/json" \
     -d '{"question":"Can I say vitamin C supports the immune system on a French product?","country":"FR"}'
   ```

## The walkthrough

### 1. Home — the pitch (0:00–0:45)
Open `http://localhost:3000`.
- Narrate: *"The EU register decides what you may print on a supplement label.
  This pipeline scrapes it, normalises it, embeds it, and answers the question
  brands actually ask."*
- Click through the **pipeline stages 01→05** on the left rail. Pause on **01
  Ingest**: the live stat cards (2,337 claims scraped) prove it's real data, not
  a mock.
- Highlight the bottom strip: *"Postgres + pgvector, 28 markets, 65,436
  country rows, human-in-the-loop."*

### 2. Explore — the money moment (0:45–3:00)
Go to **/explore**.
- The page auto-runs the default question *"Can I say vitamin C supports the
  immune system?"* in FR. Point out the result cards: register code, Authorised
  badge, "Allowed here" badge, and the **fts/vec scores** — that's hybrid
  retrieval (full-text + semantic) shown honestly.
- Click **"Read the grounded answer"** — the LLM answers from the retrieved
  claims only, with **Sources** listed below. Narrate: *"This is grounded in the
  register — the model can't invent a claim, it cites the code."*
- Click a **result card** → the market map updates to that claim's verdict.
- **The compliance demo**: click the example *"Is a DHA brain claim allowed in
  Germany?"* → shows DE verdicts. Then search *"probiotic gut health"* → the
  non-authorised claims show **"Not allowed"** on the map (the exact fix: the
  map reflects the real verdict, not a hardcoded green).

### 3. Portfolio — regulated-data honesty (3:00–4:30)
Go to **/portfolio**.
- The 6 demo SKUs across markets. Highlight **Probiotic 12 Strains (ES)** —
  flagged **"Needs review"** because its claim is NOT EU-authorised. This is the
  human-in-the-loop story: the system says *"a person must decide."*
- Show the **anomaly queue**: 3 open items. Click **Resolve** on one → it
  disappears + an **Undo** toast appears. Click **Undo** → it's back. Narrate:
  *"Regulated data has a different error budget — nothing auto-ships, a human
  signs off."*

### 4. Graph — the architecture moment (4:30–5:15)
Go to **/graph**.
- The force graph shows **products → claims → ingredients**.
- Narrate: *"This isn't a separate graph store — it's the same Postgres schema
  rendered as a graph. Products carry claims; claims reference substances."*

### 5. Close (5:15–6:00)
- Return to the **Pipeline** page.
- One line: *"Five steps, real EU data, local AI, human sign-off — from the
  register to the label, compliance end to end."*

## Failure drills

| Symptom | Fix |
|---|---|
| Anything red in healthcheck | `bash scripts/demo.sh` (idempotent, safe to re-run) |
| Grounded answer times out | Ollama cold → pre-warm via the curl above; retry |
| Anomaly queue empty | `source .venv/bin/activate && python store/demo_enrich.py` |
| Map shows nothing / all grey | Search a real query (vitamin C); select a result card |
| Gibberish query → empty state | That's **correct** — the noise filter drops it; show it as a feature |

## Honesty guardrails

- The demo numbers (2337, 269, 65436) are **real** — don't round or invent.
- Confidence bars come from `product_claims.confidence` — real values.
- If the LLM answer is imperfect, say so: *"this is why the pipeline keeps a
  human in the loop."*

## If asked about testing & security (the audit story)

The repo ships automated verification beyond the demo itself:

- **84 automated checks**: 76 Python tests (unit/integration/API/RAG-safety/
  resilience) + 20 Playwright E2E (flows, accessibility, layout).
- **RAG safety**: faithfulness (answers never invent statuses), prompt-injection
  resistance (verified against "ignore your instructions" / "repeat your system
  prompt" attacks), strict output format with register citations.
- **Security**: parameterised SQL, no `innerHTML`, CORS locked to the local web
  origin, security headers (CSP report-only, nosniff, X-Frame-Options), a
  `d3-color` ReDoS fix via npm override, and `make audit` (`pip-audit` +
  `npm audit`) reporting zero known CVEs.
- **Resilience**: the API returns clean JSON 500s when the DB is down, and
  `/api/health` stays up.
- Run them: `make test`, `make audit`, `make lint`.
