-- =============================================================================
-- T3 — Store: multi-country Postgres schema + pgvector
--
-- The EU health-claims register is EU-wide by nature. To demonstrate Kensai's
-- core promise ("same claim, different status per country") we model the real
-- regulatory reality plus the shop-floor reality:
--
--   * claims are EU-authorised / non-authorised / revoked (source of truth)
--   * each EU member state can be the home market of a product (product.country)
--   * a product carrying a claim is only compliant if that claim is authorised
--     in the EU AND the product is sold in a market where the claim applies.
--
-- Tables:
--   countries           EU member states (ISO-3166 alpha-2) + market flags
--   ingredients         substances / nutrients referenced by claims
--   claims              one row per EU claim (normalised text, type, status)
--   claim_ingredients   link claims -> ingredients (many-to-many)
--   sources             provenance: EU register item + EFSA opinions + legislation
--   country_status      the multi-country compliance pivot
--   products            SKUs sold in a market
--   product_claims      SKU -> claim mapping with compliance verdict
--   anomalies           human-in-the-loop queue (low-confidence / mismatch)
--
-- The `embedding` column (pgvector) on `claims` powers the RAG retriever.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- EU member states (the multi-country dimension)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
    code        TEXT PRIMARY KEY,          -- ISO 3166-1 alpha-2: 'FR', 'DE'...
    name        TEXT NOT NULL,
    is_market   BOOLEAN NOT NULL DEFAULT TRUE  -- is this an active sales market
);

-- -----------------------------------------------------------------------------
-- Ingredients / substances referenced by claims
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingredients (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,      -- canonical ingredient name
    category    TEXT,                      -- nutrient / botanical / probiotic...
    common_name TEXT                       -- label-friendly name
);

-- -----------------------------------------------------------------------------
-- Claims (the register itself)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claims (
    id                  SERIAL PRIMARY KEY,
    policy_item_code    TEXT NOT NULL UNIQUE,          -- POL-HC-xxxxx
    claim_text          TEXT NOT NULL,
    health_relationship TEXT,
    status              TEXT NOT NULL CHECK (status IN ('authorised','non_authorised','revoked')),
    claim_type          TEXT,                          -- Art. 13(1), 13(5), 14(1)(a)...
    conditions_of_use   TEXT,
    restriction_of_use  TEXT,
    nutrient_food_cat   TEXT,
    reasons_for_non_auth TEXT[],
    data_protection     BOOLEAN,
    embedding           vector(768)                     -- pgvector (nomic-embed-text)
);

-- Full-text search over claims (plain + multilingual-aware on demand)
CREATE INDEX IF NOT EXISTS idx_claims_fts ON claims
    USING GIN (to_tsvector('english', claim_text || ' ' || coalesce(health_relationship, '')));

-- Semantic search index (pgvector, HNSW)
CREATE INDEX IF NOT EXISTS idx_claims_embedding ON claims
    USING HNSW (embedding vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- Claims <-> ingredients join
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claim_ingredients (
    claim_id       INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    ingredient_id  INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    PRIMARY KEY (claim_id, ingredient_id)
);

-- -----------------------------------------------------------------------------
-- Provenance: where each claim came from (hostile-portal scrape + EFSA + law)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
    id              SERIAL PRIMARY KEY,
    claim_id        INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL,          -- 'eu_register' | 'efsa_opinion' | 'legislation'
    reference       TEXT,                   -- e.g. Q-2021-00073 or 2009;7(9):1210
    url             TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sources_claim ON sources(claim_id);

-- -----------------------------------------------------------------------------
-- Country pivot: the compliance answer per market
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS country_status (
    id            SERIAL PRIMARY KEY,
    claim_id      INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    country_code  TEXT NOT NULL REFERENCES countries(code),
    status        TEXT NOT NULL,           -- 'allowed' | 'restricted' | 'not_allowed'
    note          TEXT,
    UNIQUE (claim_id, country_code)
);

-- -----------------------------------------------------------------------------
-- Products / SKUs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    sku             TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    brand           TEXT,
    country_code    TEXT NOT NULL REFERENCES countries(code),  -- market of sale
    image_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Product <-> claim mapping with a compliance verdict
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_claims (
    id            SERIAL PRIMARY KEY,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    claim_id      INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    verdict       TEXT NOT NULL CHECK (verdict IN ('compliant','non_compliant','review')),
    confidence    FLOAT NOT NULL DEFAULT 1.0,
    UNIQUE (product_id, claim_id)
);

-- -----------------------------------------------------------------------------
-- Human-in-the-loop anomaly queue
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anomalies (
    id              SERIAL PRIMARY KEY,
    claim_id        INTEGER REFERENCES claims(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id) ON DELETE CASCADE,
    reason          TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
