import { ArrowRight, ArrowUpRight, Monitor, MousePointerClick } from "lucide-react";

/**
 * "See it in action" — the desktop-app flow canvas, as a screenshot.
 *
 * The marketing site is a static page; the actual payroll-flow builder
 * lives in the desktop app. So this section is a one-pane preview of
 * the canvas + a short copy explaining the drag-and-drop story.
 *
 * Layout:
 *   ┌─ Section header ─────────────────────────────────────────┐
 *   │  See it in action                                        │
 *   │  Drag-and-drop your way to a private payroll flow.       │
 *   └───────────────────────────────────────────────────────────┘
 *   ┌─ Screenshot of /desktop-flow.png ─┬─ 3-step story ───────┐
 *   │                                    │                       │
 *   │   [the actual canvas screenshot]   │  01 Drop a roster    │
 *   │                                    │  02 Wire a template  │
 *   │                                    │  03 Settle on Canton │
 *   └────────────────────────────────────┴───────────────────────┘
 */
export default function DemoScenario() {
  return (
    <section id="demo" className="bg-brand-light">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-3">
            See it in action
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-brand-navy tracking-tight leading-tight">
            Drag-and-drop your way to a{" "}
            <span className="text-brand-blue">private payroll flow</span>.
          </h2> 
        </div>

        <div className="grid lg:grid-cols-[1.25fr_1fr] gap-8 items-start">
          {/* Screenshot — the desktop app's flow canvas. */}
          <figure className="relative rounded-lg overflow-hidden border border-brand-border bg-white shadow-[0_30px_80px_-30px_rgba(10,10,92,0.28)]">
            <img
              src="/desktop-flow.png"
              alt="TamaFlow desktop app — flow canvas with a palette of payment templates on the left, an Employee card and a Payment card joined by an animated dashed connector on the right."
              className="block w-full h-auto"
            />
            {/* Caption strip — anchors the screenshot to the actual product. */}
            <figcaption className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-brand-border bg-brand-light">
              <span className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase font-semibold">
                TamaFlow desktop app
              </span>
              <a
                href="https://github.com/tamago-labs/tamaflow"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wider2 text-brand-blue uppercase font-semibold hover:underline"
              >
                Download here
                <ArrowUpRight size={9} />
              </a>
            </figcaption>
          </figure>

          {/* Right column — the drag-and-drop story + download CTA. */}
          <div className="space-y-6 lg:pt-2">
            <ol className="space-y-4">
              <Step
                icon={MousePointerClick}
                num="01"
                title="Drop a roster"
                body="Drag an Employee card from the palette onto the canvas. Add as many as the run needs."
              />
              <Step
                icon={ArrowRight}
                num="02"
                title="Wire a payment template"
                body="Drop a payment template next to the employee. TamaFlow draws the route for you."
              />
              <Step
                icon={Monitor}
                num="03"
                title="Settle on Canton, on-device"
                body="Approve, then watch the route settle on Canton. Your data never leaves the machine."
              />
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Small numbered step row — used inside the right column.                   */
/* -------------------------------------------------------------------------- */
function Step({
  icon: Icon,
  num,
  title,
  body,
}: {
  icon: typeof ArrowRight;
  num: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md bg-white border border-brand-border text-brand-blue">
        <Icon size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase font-semibold">
            {num}
          </span>
          <h3 className="text-base font-medium text-brand-navy">
            {title}
          </h3>
        </div>
        <p className="mt-1 text-sm text-brand-navy/70 leading-relaxed">
          {body}
        </p>
      </div>
    </li>
  );
}
