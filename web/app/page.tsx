import { runPipeline } from "../lib/pipeline";
import { RegimeBadge } from "../components/RegimeBadge";
import { MacroTable } from "../components/MacroTable";
import { SectorGrid } from "../components/SectorGrid";
import { CryptoPanel } from "../components/CryptoPanel";
import { ReportPanel } from "../components/ReportPanel";

export const revalidate = 300; // ISR: revalidate every 5 minutes

const SectionLabel = ({
  title,
  meta,
}: {
  title: string;
  meta?: string;
}) => (
  <div className="flex items-center gap-2 mb-2">
    <h2 className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-500">
      {title}
    </h2>
    {meta && (
      <>
        <span className="text-zinc-800">—</span>
        <span className="text-[9px] font-mono text-zinc-700">{meta}</span>
      </>
    )}
  </div>
);

export default async function Dashboard() {
  const data = await runPipeline();

  const macroRegime = data.sectors[0]?.macroRegime ?? null;
  const cryptoRegime = data.categories[0]?.cryptoRegime ?? null;
  const dataSource = data.dataSource ?? "FIXTURE";
  const isFoundry = dataSource === "FOUNDRY";
  const isLive    = dataSource === "LIVE";

  const updatedAt = new Date(data.generatedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <div className="min-h-screen bg-[#07080a]">
      {/* ── Top nav ── */}
      <header className="border-b border-zinc-900 bg-[#070809]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex items-center justify-between h-11">
            {/* Left: branding */}
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono font-semibold text-zinc-700 uppercase tracking-[0.25em]">
                Foundry
              </span>
              <span className="text-zinc-800 select-none">│</span>
              <span className="text-sm font-semibold text-zinc-200 tracking-tight">
                Macro Research
              </span>
            </div>

            {/* Right: regime + live status */}
            <div className="flex items-center gap-5">
              {/* Regime indicators */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">
                  Macro
                </span>
                <RegimeBadge regime={macroRegime} />
                <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest ml-1.5">
                  Crypto
                </span>
                <RegimeBadge regime={cryptoRegime} />
              </div>

              {/* Data source indicator */}
              <div className="flex items-center gap-1.5 border-l border-zinc-800/60 pl-5">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isFoundry
                      ? "bg-indigo-400 shadow-[0_0_4px_1px_rgba(129,140,248,0.5)]"
                      : isLive
                        ? "bg-green-400 shadow-[0_0_4px_1px_rgba(74,222,128,0.5)]"
                        : "bg-amber-500"
                  }`}
                />
                <span className="text-[9px] font-mono text-zinc-600 whitespace-nowrap">
                  {isFoundry ? "FOUNDRY" : isLive ? "LIVE" : "FIXTURE"} · {updatedAt}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-7">

        {/* Macro Indicators — full width */}
        <section>
          <SectionLabel
            title="Macro Indicators"
            meta={isFoundry
              ? `${data.indicators.length} series · SRC: PALANTIR FOUNDRY`
              : `${data.indicators.length} series · SRC: FRED`}
          />
          <MacroTable indicators={data.indicators} />
        </section>

        {/* Sectors + Crypto — 2-col on large screens */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-7">
          <section>
            <SectionLabel
              title="Sector Performance"
              meta={isFoundry
                ? `${data.sectors.length} ETFs · SRC: PALANTIR FOUNDRY`
                : `${data.sectors.length} ETFs · SRC: Yahoo Finance`}
            />
            <SectorGrid sectors={data.sectors} />
          </section>
          <section>
            <SectionLabel
              title="Crypto Markets"
              meta={isFoundry
                ? "SRC: PALANTIR FOUNDRY"
                : "SRC: CoinMarketCap · DeFiLlama · Alternative.me"}
            />
            <CryptoPanel
              metrics={data.cryptoMetrics}
              categories={data.categories}
            />
          </section>
        </div>

        {/* AI Report */}
        <section>
          <ReportPanel data={data} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 mt-12 px-6 py-4 max-w-screen-xl mx-auto">
        <p className="text-[9px] font-mono text-zinc-700 tracking-wide">
          FOR INFORMATIONAL PURPOSES ONLY · NOT FINANCIAL ADVICE · DATA MAY BE
          DELAYED OR INACCURATE · DO NOT TRADE BASED ON THIS OUTPUT
        </p>
      </footer>
    </div>
  );
}
