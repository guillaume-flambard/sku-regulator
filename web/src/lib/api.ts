const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export type ClaimStatus = "authorised" | "non_authorised" | "revoked";
export type CountryVerdict = "allowed" | "restricted" | "not_allowed";

export interface ClaimResult {
  policy_item_code: string;
  claim_text: string;
  health_relationship: string | null;
  status: ClaimStatus;
  claim_type: string | null;
  score?: number;
  matches?: { fts?: number; vector?: number; _rank?: number };
  country_status?: CountryVerdict;
}

export interface AskResult {
  question: string;
  country: string;
  answer: string;
  sources: {
    policy_item_code: string;
    claim_text: string;
    status: ClaimStatus;
    country_status?: CountryVerdict;
  }[];
}

export interface Stats {
  claims: number;
  authorised: number;
  non_authorised: number;
  ingredients: number;
  products: number;
  sources: number;
  open_anomalies: number;
}

export interface Country {
  code: string;
  name: string;
}

export interface Anomaly {
  id: number;
  reason: string;
  severity: "low" | "medium" | "high";
  status: "open" | "resolved" | "dismissed";
  created_at: string | null;
  claim_code: string | null;
  claim_text: string | null;
  product_sku: string | null;
  product_name: string | null;
}

export interface Product {
  sku: string;
  name: string;
  brand: string;
  country_code: string;
  compliant: number;
  non_compliant: number;
}

export interface GraphNode {
  id: string;
  kind: "product" | "claim" | "ingredient";
  label: string;
  status?: string;
  country?: string;
  brand?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  stats: () => get<Stats>("/api/stats"),
  countries: () => get<{ countries: Country[] }>("/api/countries"),
  search: (q: string, country = "FR", topK = 5) =>
    get<{ query: string; country: string; results: ClaimResult[] }>(
      `/api/claims?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}&top_k=${topK}`,
    ),
  ask: (question: string, country = "FR") =>
    post<AskResult>("/api/ask", { question, country }),
  anomalies: () => get<{ anomalies: Anomaly[] }>("/api/anomalies"),
  resolveAnomaly: (id: number) => post(`/api/anomalies/${id}/resolve`, {}),
  products: (country?: string) =>
    get<{ products: Product[] }>(
      `/api/products${country ? `?country=${encodeURIComponent(country)}` : ""}`,
    ),
  graph: () => get<GraphData>("/api/graph"),
};
