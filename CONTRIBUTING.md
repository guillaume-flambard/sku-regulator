# Contributing to sku-regulator

This project is a full-stack engineering demonstration involving regulated information. Contributions are welcome when they make data provenance, correctness, usability or reproducibility better.

Please open an issue before broad architecture changes, data-source changes, legal-claim logic changes or new AI model integrations.

## Setup

The complete local product requires Docker, Python 3.11+, Node.js and local embedding/generation models through Ollama. Ollama downloads and models can require substantial RAM and disk space; it is not necessary for a documentation-only contribution.

See [README.md](README.md) and [docs/demo-runbook.md](docs/demo-runbook.md) for the existing scripts.

```sh
make lint
make test
make audit
```

Run relevant unit tests first, then the full integration/browser suite if changing API, database or UI behavior. `make test` may need started services, dependencies and sufficient resources; read the Makefile and healthcheck before running.

## What to include in a PR

- A concrete observed problem and precise scope.
- Source URL, recorded collection timestamp and citation/provenance when touching regulatory data.
- Tests for corrected behavior, including negative examples and source corruption or ambiguity.
- Screenshots or a real browser capture for UX changes, with no client or patient data.
- A validation table: exact commands, commit, environment, results and limitations.

Never claim that retrieval, embeddings, an LLM answer or CI confer legal approval. Changes to regulation modelling must distinguish **source-record observation** from **human legal assessment**.

Do not add real confidential customer data, credentials or production keys. See [SECURITY.md](SECURITY.md) for private vulnerability reporting.
