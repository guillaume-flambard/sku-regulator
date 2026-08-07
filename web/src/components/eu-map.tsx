"use client";

import { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import type { CountryVerdict } from "@/lib/api";

// Bundled at build time — no runtime fetch, works fully offline.
import topology from "@/data/countries-110m.json";

/**
 * EU market map built from real geography (world-atlas TopoJSON), bundled as a
 * module so the demo works offline and never depends on static-file serving.
 * Countries are colored by the per-country claim verdict.
 *
 * world-atlas uses ISO 3166-1 numeric ids (zero-padded or not — e.g. "040"
 * Austria, "826" UK). We map the demo's alpha-2 market codes onto them. Malta
 * ("470") is absent at the 110m resolution, so it is not drawn, but its
 * verdict data still exists.
 */

// world-atlas numeric id -> alpha-2 market code
const ISO_NUMERIC_TO_CODE: Record<string, string> = {
  "040": "AT", "056": "BE", "100": "BG", "191": "HR", "196": "CY",
  "203": "CZ", "208": "DK", "233": "EE", "246": "FI", "250": "FR",
  "276": "DE", "300": "GR", "348": "HU", "372": "IE", "380": "IT",
  "428": "LV", "440": "LT", "442": "LU", "528": "NL", "616": "PL",
  "620": "PT", "642": "RO", "703": "SK", "705": "SI", "724": "ES",
  "752": "SE", "826": "GB",
};

const NAME: Record<string, string> = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", HR: "Croatia", CY: "Cyprus",
  CZ: "Czechia", DK: "Denmark", EE: "Estonia", FI: "Finland", FR: "France",
  DE: "Germany", GR: "Greece", HU: "Hungary", IE: "Ireland", IT: "Italy",
  LV: "Latvia", LT: "Lithuania", LU: "Luxembourg", NL: "Netherlands",
  PL: "Poland", PT: "Portugal", RO: "Romania", SK: "Slovakia", SI: "Slovenia",
  ES: "Spain", SE: "Sweden", GB: "United Kingdom",
};

const VERDICT_FILL: Record<CountryVerdict, string> = {
  allowed: "#d9efe4",
  restricted: "#f7e6c3",
  not_allowed: "#f5dcd6",
};

const VERDICT_STROKE: Record<CountryVerdict, string> = {
  allowed: "#0f6b4f",
  restricted: "#b7791f",
  not_allowed: "#b3402e",
};

const NEUTRAL_FILL = "#ecefe9";
const NEUTRAL_STROKE = "#c8d1cc";
const OTHER_FILL = "#f3f4f1";

export function EuMap({
  verdicts,
  activeCode,
}: {
  verdicts: Record<string, CountryVerdict>;
  activeCode?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ scale: 330, center: [15, 53] }}
      width={400}
      height={300}
      style={{ width: "100%", height: "auto" }}
    >
      <Geographies geography={topology}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const code = geo.id ? ISO_NUMERIC_TO_CODE[geo.id] : undefined;
            const isMarket = Boolean(code);
            const verdict = code ? verdicts[code] : undefined;
            const active = code === activeCode;
            const hover = code === hovered;

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={isMarket ? (verdict ? VERDICT_FILL[verdict] : NEUTRAL_FILL) : OTHER_FILL}
                stroke={active ? "#111" : hover ? "#3a4a42" : isMarket ? (verdict ? VERDICT_STROKE[verdict] : NEUTRAL_STROKE) : "#e2e7e3"}
                strokeWidth={active ? 1.4 : 0.7}
                opacity={activeCode && !active ? 0.6 : 1}
                onMouseEnter={() => code && setHovered(code)}
                onMouseLeave={() => setHovered(null)}
                style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
              >
                {code && (
                  <title>
                    {NAME[code] ?? code} — {verdict ?? "not queried"}
                  </title>
                )}
              </Geography>
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
