import { ArrowRight, TrendingDown, Lock, EyeOff } from "lucide-react";

const countries = [
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "TH", name: "Thailand", currency: "THB" },
  { code: "SG", name: "Singapore", currency: "SGD" },
];

/**
 * "Demo Scenario" — the JP/TH/SG case study from the brief, shown as
 * a two-column layout: left = the countries in mono badges, right =
 * a big "18% savings" callout card with two side benefits
 * (privacy + employee visibility).
 */
export default function DemoScenario() {
  return (
    <section id="demo" className="bg-brand-light">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-3">
            Demo Scenario
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-brand-navy tracking-tight leading-tight">
            A startup in{" "}
            <span className="text-brand-blue">three countries</span>.
            One private settlement.
          </h2>
          <p className="mt-4 text-base text-brand-navy/70 leading-relaxed">
            Instead of initiating separate transfers, TamaFlow nets
            obligations across currencies and settles them atomically on
            Canton.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 items-stretch">
          {/* Left: employer view */}
          <div className="bg-white border border-brand-border rounded-md p-6 lg:p-8 flex flex-col">
            <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold mb-4">
              Employer view
            </p>

            {/* Country badges */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {countries.map((c, i) => (
                <span
                  key={c.code}
                  className="inline-flex items-center gap-2 bg-brand-light border border-brand-border rounded-md px-3 py-2"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-brand-navy text-white font-mono text-[10px] font-bold">
                    {c.code}
                  </span>
                  <span className="font-mono text-[11px] tracking-wider2 text-brand-navy uppercase font-semibold">
                    {c.name}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase">
                    {c.currency}
                  </span>
                </span>
              ))}
            </div>

            {/* Netting flow visualisation */}
            <div className="flex items-center gap-3 mb-6 text-brand-muted">
              <div className="flex-1 h-px bg-brand-border" />
              <span className="font-mono text-[9px] tracking-wider2 text-brand-muted uppercase">
                Net obligations
              </span>
              <div className="flex-1 h-px bg-brand-border" />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { l: "Gross Payroll", v: "¥ 4.20M" },
                { l: "After Netting", v: "¥ 3.45M" },
                { l: "Settled", v: "01 TX" },
              ].map((k) => (
                <div
                  key={k.l}
                  className="border border-brand-border rounded p-3"
                >
                  <p className="font-mono text-[8px] tracking-wider2 text-brand-muted uppercase font-semibold mb-1">
                    {k.l}
                  </p>
                  <p className="text-sm font-light text-brand-navy">
                    {k.v}
                  </p>
                </div>
              ))}
            </div>

            {/* Approval toast */}
            <div className="mt-auto border border-brand-ok/40 bg-[#e6f7ee] rounded-md p-4 flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-brand-ok mt-1.5 flex-shrink-0" />
              <div>
                <p className="font-mono text-[10px] tracking-wider2 text-brand-ok uppercase font-bold mb-1">
                  Approved
                </p>
                <p className="text-sm text-brand-navy">
                  Payroll approved. Estimated FX and settlement savings{" "}
                  <span className="font-semibold text-brand-ok">
                    18%
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* Right: outcomes stack */}
          <div className="flex flex-col gap-4">
            {/* Big savings card */}
            <div className="bg-brand-navy text-white rounded-md p-6 lg:p-8 relative overflow-hidden">
              <div
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(62, 196, 192, 0.35) 0%, rgba(62, 196, 192, 0) 70%)",
                }}
              />
              <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold mb-2">
                Estimated savings
              </p>
              <div className="flex items-end gap-3">
                <span className="text-7xl font-light text-white leading-none">
                  18
                </span>
                <span className="text-2xl text-brand-teal font-light mb-2">
                  %
                </span>
                <TrendingDown
                  size={28}
                  className="text-brand-teal mb-3 ml-1"
                />
              </div>
              <p className="mt-3 text-sm text-white/70 max-w-md">
                FX and settlement fees eliminated by netting obligations
                across JPY, THB, and SGD before atomic settlement.
              </p>
              <div className="mt-6 flex items-center gap-2 text-brand-teal">
                <span className="font-mono text-[10px] tracking-wider2 uppercase font-semibold">
                  See the maths
                </span>
                <ArrowRight size={12} />
              </div>
            </div>

            {/* Two benefit cards */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white border border-brand-border rounded-md p-5">
                <Lock size={18} className="text-brand-blue mb-3" />
                <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold mb-1">
                  Employer
                </p>
                <p className="text-sm text-brand-navy leading-relaxed">
                  Sees totals, country distribution, anomalies, and
                  estimated savings. <span className="text-brand-muted">Nothing else.</span>
                </p>
              </div>
              <div className="bg-white border border-brand-border rounded-md p-5">
                <EyeOff size={18} className="text-brand-blue mb-3" />
                <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold mb-1">
                  Employee
                </p>
                <p className="text-sm text-brand-navy leading-relaxed">
                  Sees only their own payslip. The full payroll dataset
                  is invisible — to them and to the network.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
