"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CircleNotch } from "@phosphor-icons/react";

import { api } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";
import { Eyebrow } from "@/components/badges";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface GNode {
  id: string;
  kind: "product" | "claim" | "ingredient";
  label: string;
  status?: string;
  country?: string;
  brand?: string;
}
interface GEdge {
  source: string;
  target: string;
  type: string;
}

const COLOR: Record<GNode["kind"], string> = {
  product: "#0f6b4f",
  claim: "#b7791f",
  ingredient: "#5b6b63",
};

const LABEL: Record<GNode["kind"], string> = {
  product: "Product / SKU",
  claim: "EU claim",
  ingredient: "Ingredient",
};

export default function GraphPage() {
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    api
      .graph()
      .then((d) => {
        setNodes(d.nodes as GNode[]);
        setEdges(d.edges as GEdge[]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(
    () => ({ nodes, links: edges.map((e) => ({ ...e })) }),
    [nodes, edges],
  );

  return (
    <div className="min-h-[100dvh] bg-mist">
      <SiteHeader />

      <main className="mx-auto max-w-container-max px-gutter py-12">
        <Eyebrow>Knowledge graph</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Products, claims, ingredients — one view
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          How the register connects to what actually ships. Each SKU carries
          claims; each claim references ingredients. Drag to explore.
        </p>

        {/* legend */}
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted">
          {(Object.keys(LABEL) as GNode["kind"][]).map((k) => (
            <span key={k} className="inline-flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: COLOR[k] }}
              />
              {LABEL[k]}
            </span>
          ))}
        </div>

        <div
          ref={containerRef}
          className="mt-6 h-[560px] overflow-hidden rounded-xl border border-line bg-white"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-muted">
              <CircleNotch size={18} className="animate-spin" /> Building graph…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-danger">
              {error} — is the backend running on :8000?
            </div>
          ) : (
            <ForceGraph2D
              width={width}
              height={560}
              graphData={data}
              nodeLabel={(n: unknown) => {
                const node = n as GNode;
                const extra =
                  node.kind === "product"
                    ? ` · ${node.country}`
                    : node.kind === "claim"
                      ? ` · ${node.status}`
                      : "";
                return `${node.label}${extra}`;
              }}
              nodeColor={(n: unknown) => COLOR[(n as GNode).kind]}
              nodeVal={(n: unknown) => ((n as GNode).kind === "product" ? 12 : 5)}
              nodeCanvasObjectMode={() => "after"}
              nodeCanvasObject={(node: unknown, ctx) => {
                const n = node as GNode & { x: number; y: number };
                const label = n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label;
                const fontSize = n.kind === "product" ? 12 : 10;
                ctx.font = `${fontSize}px "Geist Mono", monospace`;
                // measure + draw a rounded backdrop so labels never collide with edges/nodes
                const w = ctx.measureText(label).width;
                ctx.fillStyle = "rgba(255,255,255,0.92)";
                ctx.strokeStyle = "rgba(24,33,29,0.12)";
                ctx.lineWidth = 1;
                const bx = n.x - w / 2 - 4;
                const by = n.y + 10;
                const bw = w + 8;
                const bh = fontSize + 8;
                const r = 4;
                ctx.beginPath();
                ctx.moveTo(bx + r, by);
                ctx.lineTo(bx + bw - r, by);
                ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
                ctx.lineTo(bx + bw, by + bh - r);
                ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
                ctx.lineTo(bx + r, by + bh);
                ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
                ctx.lineTo(bx, by + r);
                ctx.quadraticCurveTo(bx, by, bx + r, by);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = "rgba(24,33,29,0.9)";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, n.x, by + fontSize / 2 + 4);
              }}
              linkColor={() => "rgba(24,33,29,0.15)"}
              linkDirectionalParticles={1}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleColor={() => "#0f6b4f"}
              cooldownTicks={100}
            />
          )}
        </div>

        <p className="mt-4 text-sm text-muted">
          Every node and edge comes from the same Postgres database the rest of
          the demo reads — this is the relational schema rendered as a graph,
          not a separate store.
        </p>
      </main>
    </div>
  );
}
