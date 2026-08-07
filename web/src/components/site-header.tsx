"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Pipeline" },
  { href: "/explore", label: "Explore" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/graph", label: "Graph" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-container-max items-center justify-between px-gutter">
        <Link href="/" className="group flex items-center gap-3">
          {/* real logo mark (public/logo.svg) */}
          <Image
            src="/logo.svg"
            alt="sku-regulator"
            width={32}
            height={32}
            className="h-8 w-8 drop-shadow-sm transition-transform group-hover:scale-105"
          />
          <div className="flex flex-col leading-none">
            <span className="font-display-h1 text-[17px] font-bold tracking-tight text-ink">
              sku-regulator
            </span>
            <span className="mt-0.5 font-data-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              EU health-claims intelligence
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 md:gap-2">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const hideMobile = item.label === "Portfolio";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-body-sm font-semibold transition-colors ${
                  hideMobile ? "hidden md:inline" : ""
                } ${
                  active
                    ? "bg-sage-soft text-sage"
                    : "text-muted hover:bg-surface-container-low hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </nav>
  );
}
