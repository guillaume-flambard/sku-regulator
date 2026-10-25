# Security policy

## Maturity and support

sku-regulator is an **engineering prototype**; the public video illustrates a scripted demo. It has **not** been independently certified for legal compliance or production handling of sensitive personal/customer data. No security SLA, guaranteed response time or supported production-version window is offered.

## Private vulnerability reports

Do not publish exploitable details, credentials, live customer identifiers or private data in a GitHub issue.

If GitHub Private Vulnerability Reporting is enabled for the repository, use **Security → Report a vulnerability**. If that option is unavailable, ask the maintainer for a private disclosure channel through the [contact on the GitHub profile](https://github.com/guillaume-flambard); send only non-sensitive context until a secure channel has been arranged.

Useful report details include the affected commit/version, minimal reproduction, environment, demonstrated impact and mitigation options. Do not scan someone else's deployment or retrieve private data.

## Sensitive boundaries to review

- Imported data source provenance, integrity and freshness.
- SQL query parameters and database access.
- API access, data validation and error handling.
- Prompt-injection isolation, source-citation fidelity and refusal to issue unsupported determinations.
- Exposure of embedded source text and logs, client secrets and private files.
- Human-review controls before a product label or claim is approved.

Automated dependency audits and E2E checks help, but cannot guarantee complete security. Keep all real regulated business decisions under expert human review.
