import Link from "next/link";
import { Github } from "lucide-react";
import Wordmark from "@/components/shared/Wordmark";
import { SITE } from "@/lib/theme";
import { marketingNav } from "@/lib/nav";

/**
 * Site-wide footer for the marketing site.
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
          </div>

          {/* Sections */}
          <FooterCol
            title="Product"
            links={[
              { href: "#features", label: "Features" },
              { href: "#flow", label: "How it works" },
              { href: "https://github.com/tamago-labs/tamaflow#why-canton", label: "Why Canton" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { href: "https://tamagolabs.com", label: "Tamago Labs" },
              { href: "mailto:pisuth@tamagolabs.com", label: "Contact Us" },
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
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/tamago-labs/tamaflow"
              aria-label="GitHub"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 border border-brand-border rounded-md text-brand-navy hover:bg-brand-light"
            >
              <Github size={14} />
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
