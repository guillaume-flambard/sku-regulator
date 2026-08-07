#!/usr/bin/env python3
"""T4b — Answer: turn retrieved claims into a cited, compliance-aware answer.

Uses LangChain with a local Ollama LLM (llama3.2). The prompt is grounded ONLY
in the retrieved claims — the model may not invent regulations. Every answer
cites the EU Register code and the per-country status.

This is the "no AI jargon" story Kensai wants: a founding engineer who shows
the pipeline, not a wrapper around a magic model.
"""

from __future__ import annotations

import argparse
import json
import os

from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama

from rag.retrieve import country_lookup, hybrid_search

OLLAMA_MODEL = os.environ.get("SKU_LLM_MODEL", "llama3.2:3b")

PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are the compliance assistant of a health & wellness SKU intelligence
platform. You answer questions about whether a health claim is allowed in a given
country, using ONLY the supplied EU Register entries. Never invent claims,
regulations or statuses. If the data does not contain an answer, say so.

For each claim you rely on, cite it as: [POL-HC-xxxxx · <status> · <country>: <allowed|not_allowed>].""",
        ),
        (
            "human",
            """QUESTION: {question}
TARGET COUNTRY: {country}

EU REGISTER ENTRIES (retrieved):
{context}

Answer in 2-4 short paragraphs. End with a "Sources" list citing the register codes.""",
        ),
    ],
)


def answer_question(question: str, country: str = "FR", top_k: int = 4) -> dict:
    retrieval = hybrid_search(question, top_k=top_k)
    codes = [r["policy_item_code"] for r in retrieval["results"]]
    countries = country_lookup(codes, country)

    context_lines = []
    for r in retrieval["results"]:
        cs = countries.get(r["policy_item_code"], {})
        context_lines.append(
            f"- {r['policy_item_code']} | status={r['status']} | {country}={cs.get('status')} "
            f"| claim: {r['claim_text']}"
        )
    context = "\n".join(context_lines)

    llm = ChatOllama(model=OLLAMA_MODEL, temperature=0.1)
    chain = PROMPT | llm
    answer = chain.invoke(
        {"question": question, "country": country, "context": context}
    ).content

    return {
        "question": question,
        "country": country,
        "answer": answer,
        "sources": [
            {
                "policy_item_code": r["policy_item_code"],
                "claim_text": r["claim_text"][:240],
                "status": r["status"],
                "country_status": countries.get(r["policy_item_code"], {}).get("status"),
            }
            for r in retrieval["results"]
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--question", default="Can I claim that vitamin C supports the immune system on my product label?")
    ap.add_argument("--country", default="FR")
    args = ap.parse_args()

    out = answer_question(args.question, args.country)
    print(f"\nQ: {out['question']}")
    print(f"Market: {out['country']}\n")
    print(out["answer"])
    print("\n--- SOURCES ---")
    for s in out["sources"]:
        print(f"• {s['policy_item_code']} [{s['status']}] {args.country}: {s['country_status']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
