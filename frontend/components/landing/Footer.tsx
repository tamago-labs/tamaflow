import Link from "next/link";
import { ArrowUpRight, Github, Twitter } from "lucide-react";
import Wordmark from "@/components/shared/Wordmark";
import { SITE } from "@/lib/theme";
import { marketingNav } from "@/lib/nav";

/**
 * Site-wide footer for the marketing site. Shows the wordmark + a
 * short tagline, three columns of links, the social row, and the
 * mono version badge (matches the desktop-app sidebar footer style).
 */
export default function Footer() {
  return (
    <footer className="bg-white border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        <div className="grid lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          {/* Brand */}
          <div>
            <Wordmark size="md" />
            <p className="mt-4 text-sm text-brand-navy/70 max-w-xs leading-relaxed">
              {SITE.shortDesc}
            </p>
            <Link
              href="/app"
              className="mt-5 inline-flex items-center gap-1.5 py-2 px-4 bg-brand-blue text-white rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase no-underline hover:opacity-90"
            >
              Launch App
              <ArrowUpRight size={12} />
            </Link>
          </div>

          {/* Sections */}
          <FooterCol
            title="Product"
            links={[
              { href: "#features", label: "Features" },
              { href: "#flow", label: "How it works" },
              { href: "#why-canton", label: "Why Canton" },
              { href: "/app", label: "Open app" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { href: "#problem", label: "Problem" },
              { href: "#solution", label: "Solution" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { href: "#privacy", label: "Privacy" },
              { href: "#terms", label: "Terms" },
              { href: "#security", label: "Security" },
            ]}
          />
        </div>

        {/* Bottom strip */}
        <div className="mt-12 pt-6 border-t border-brand-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
              © {new Date().getFullYear()} {SITE.name}
            </p>
            {/* <span className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
              ·
            </span>
            <p className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
              {SITE.version} · TamaFlow
            </p> */}
          </div>
          <div className="flex items-center gap-3">
            {marketingNav.slice(0, 3).map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase no-underline hover:text-brand-navy"
              >
                {n.label}
              </a>
            ))}
            <a
              href="https://github.com/tamago-labs/tamaflow"
              aria-label="GitHub"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 border border-brand-border rounded-md text-brand-navy hover:bg-brand-light"
            >
              <Github size={14} />
            </a>
            <a
              href={`https://twitter.com/${SITE.twitter.replace("@", "")}`}
              aria-label="Twitter"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 border border-brand-border rounded-md text-brand-navy hover:bg-brand-light"
            >
              <Twitter size={14} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold mb-3">
        {title}
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="text-sm text-brand-navy hover:text-brand-blue transition-colors no-underline"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
