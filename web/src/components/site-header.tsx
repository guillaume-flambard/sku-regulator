"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react";

const NAV = [
  { href: "/", label: "Pipeline" },
  { href: "/explore", label: "Explore" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/graph", label: "Graph" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-container-max items-center justify-between px-gutter">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-white">
              <ShieldCheck size={18} weight="fill" />
            </div>
            <div className="leading-tight">
              <div className="text-headline-md font-bold tracking-tight text-primary">sku-regulator</div>
              <div className="-mt-0.5 block font-data-mono text-[10px] uppercase tracking-wider text-muted">
                EU health-claims intelligence
              </div>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const hideMobile = item.label === "Portfolio";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`pb-1 text-body-base font-semibold transition-colors ${
                  hideMobile ? "hidden md:inline" : ""
                } ${
                  active ? "border-b-2 border-primary text-primary" : "text-muted hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
