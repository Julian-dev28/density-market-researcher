import { runPipeline } from "../lib/pipeline";
import { RegimeBadge } from "../components/RegimeBadge";
import { MacroTable } from "../components/MacroTable";
import { SectorGrid } from "../components/SectorGrid";
import { CryptoPanel } from "../components/CryptoPanel";
import { ReportPanel } from "../components/ReportPanel";

export default function Dashboard() {
  const data = runPipeline();

  // Regimes are embedded in sector/category objects by the transform layer
  const macroRegime = data.sectors[0]?.macroRegime ?? null;
  const cryptoRegime = data.categories[0]?.cryptoRegime ?? null;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Macro + Crypto Research
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Foundry Macro Research · Fixture data · Updated{" "}
            {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Macro
          </span>
          <RegimeBadge regime={macroRegime} />
          <span className="text-xs text-zinc-500 uppercase tracking-wider ml-2">
            Crypto
          </span>
          <RegimeBadge regime={cryptoRegime} />
        </div>
      </div>

      {/* Three-column data grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Macro Indicators ({data.indicators.length})
          </h2>
          <MacroTable indicators={data.indicators} />
        </div>

        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Sector Snapshots ({data.sectors.length})
          </h2>
          <SectorGrid sectors={data.sectors} />
        </div>

        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Crypto Markets
          </h2>
          <CryptoPanel metrics={data.cryptoMetrics} categories={data.categories} />
        </div>
      </div>

      {/* Streaming report */}
      <ReportPanel data={data} />
    </main>
  );
}
