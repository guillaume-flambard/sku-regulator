"use client";

import type { CountryVerdict } from "@/lib/api";

/**
 * Self-contained EU map for the demo. Simplified country outlines for the
 * markets the register cares about — no external topojson download, works
 * offline, colored by the per-country claim verdict.
 *
 * Coordinates are a rough 0..100 viewBox approximation of Europe.
 */

const PATHS: Record<string, string> = {
  FR: "M41 20 Q50 18 54 22 L56 26 Q59 28 57 31 L60 34 Q59 38 55 39 L52 42 Q48 45 46 49 L43 47 Q40 44 39 40 L36 37 Q34 33 36 29 L38 26 Q39 22 41 20 Z",
  DE: "M57 12 Q62 13 63 17 Q66 18 65 22 L66 26 Q63 28 61 27 L60 31 Q57 30 56 27 L54 24 Q53 20 55 17 Z",
  ES: "M29 58 Q33 55 36 57 L37 62 Q34 64 31 63 L29 61 Z",
  IT: "M65 45 Q68 46 67 50 Q68 54 65 57 Q64 53 63 49 Q64 47 65 45 Z",
  NL: "M58 4 L61 5 L60 8 L58 8 Z",
  GB: "M51 2 Q55 0 57 3 L56 7 Q52 8 50 6 Z",
  PL: "M66 16 Q71 15 73 18 L74 23 Q70 25 68 23 L66 21 Z",
  PT: "M25 58 Q27 57 28 60 L27 64 Q25 63 24 61 Z",
  SE: "M67 0 Q71 1 71 6 Q69 9 67 8 Z",
  AT: "M65 24 Q68 23 69 26 L67 29 Q64 28 65 24 Z",
  BE: "M58 7 Q60 7 60 9 L58 10 Q57 9 58 7 Z",
};

const LABELS: Record<string, [number, number]> = {
  FR: [47, 33],
  DE: [61, 20],
  ES: [32, 59],
  IT: [65, 50],
  NL: [60, 6],
  GB: [54, 4],
  PL: [70, 19],
  PT: [27, 61],
  SE: [69, 4],
  AT: [66, 26],
  BE: [59, 9],
};

const VERDICT_FILL: Record<CountryVerdict, { fill: string; stroke: string }> = {
  allowed: { fill: "#d9efe4", stroke: "#0f6b4f" },
  restricted: { fill: "#f7e6c3", stroke: "#b7791f" },
  not_allowed: { fill: "#f5dcd6", stroke: "#b3402e" },
};

export function EuMap({
  verdicts,
  activeCode,
}: {
  verdicts: Record<string, CountryVerdict>;
  activeCode?: string;
}) {
  const defaultFill = { fill: "#ecefe9", stroke: "#c8d1cc" };
  return (
    <svg
      viewBox="20 0 60 70"
      role="img"
      aria-label="European Union market map with claim verdicts"
      className="w-full h-auto"
    >
      {Object.entries(PATHS).map(([code, d]) => {
        const v = verdicts[code];
        const style = v ? VERDICT_FILL[v] : defaultFill;
        const active = activeCode === code;
        return (
          <path
            key={code}
            d={d}
            fill={style.fill}
            stroke={active ? "#111" : style.stroke}
            strokeWidth={active ? 1.4 : 0.8}
            opacity={activeCode && !active ? 0.55 : 1}
            className="transition-opacity"
          />
        );
      })}
      {Object.entries(LABELS).map(([code, [x, y]]) => (
        <text
          key={code}
          x={x}
          y={y}
          fontSize="4.5"
          textAnchor="middle"
          className="fill-foreground/60 font-mono"
        >
          {code}
        </text>
      ))}
    </svg>
  );
}
