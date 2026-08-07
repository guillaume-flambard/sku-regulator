# Kensai application email

To: **karina@kensai.ai**
Exact subject: **`Kensai | Founding engineer`**

> Applications without the exact subject line are not read. Tone: direct, no AI
> jargon, show the build. The three requested deliverables are included.

---

**Subject: Kensai | Founding engineer**

Hi Karina,

The job posting describes a build I have been doing for the past year, so I did
the exercise for real. I built the thing you described against the actual EU
register, and shipped it end to end.

**1. Proof you build**

github.com/guillaume-flambard/sku-regulator is an SKU-intelligence pipeline over
the EU Register of Nutrition & Health Claims, about 2,300 claims. It scrapes the
register, which is a hostile JS portal with no public API. Then it flattens the
mess into a Postgres + pgvector schema with a per-country status pivot, and it
answers the compliance question in plain language. "Is this claim legal where I
sell?" Grounded in the register, with sources and per-market verdicts shown.

What was hard was the data, not the code. The register is a reverse-engineering
problem first. After that came the part I care about most: keeping every number
real and reproducible. CI is green on every push, 90+ automated checks, and the
RAG layer is tested against hallucination and prompt injection. There is a
70-second demo video in the repo that the repo generates itself.

LinkedIn: linkedin.com/in/guillaume-flambard

**2. The 20-minute take**

The repo's docs/architecture.md is that take. How I would build the
SKU-intelligence dashboard, step by step: the schema, the multi-country model,
hybrid retrieval, and where a human has to stay in the loop. Short and concrete.
If you prefer a recording, I can make one.

**3. The question I need answered**

Before I bet the next few years on this, I need to know what moat you are
protecting. Is it the data pipeline itself, or the go-to-market with the big
brands? Those are two different builds, and the answer decides where a founding
engineer should spend the first six months.

---

Guillaume Flambard
github.com/guillaume-flambard · linkedin.com/in/guillaume-flambard
Paris, France. Full remote, CET.
