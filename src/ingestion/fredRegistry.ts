import type { IndicatorCategory } from "../types/index.js";

// ============================================================
// FRED Series Registry
//
// Defines the economic indicators to track and their metadata.
// All series IDs are from the St. Louis Fed FRED database.
// Browse the full catalog at: https://fred.stlouisfed.org/
//
// To add a new indicator: add an entry here and it will be
// automatically ingested on the next pipeline run.
// ============================================================

export interface SeriesDefinition {
  seriesId: string;
  name: string;
  category: IndicatorCategory;
  description: string;
  /** Sectors most directly affected by this indicator */
  affectedSectors: string[];
  /** If true, rising value is bearish for risk assets */
  inverseSentiment: boolean;
}

export const FRED_SERIES: SeriesDefinition[] = [
  // --- Interest Rates ---
  {
    seriesId: "DFF",
    name: "Federal Funds Effective Rate",
    category: "INTEREST_RATES",
    description: "The interest rate at which depository institutions trade federal funds overnight.",
    affectedSectors: ["XLF", "XLRE", "XLU"],
    inverseSentiment: true,
  },
  {
    seriesId: "DGS10",
    name: "10-Year Treasury Constant Maturity Rate",
    category: "INTEREST_RATES",
    description: "Yield on 10-year US Treasury notes — benchmark for mortgage rates and risk pricing.",
    affectedSectors: ["XLRE", "XLU", "XLF"],
    inverseSentiment: true,
  },
  {
    seriesId: "T10Y2Y",
    name: "10-Year minus 2-Year Treasury Spread",
    category: "INTEREST_RATES",
    description: "Yield curve spread. Negative (inverted) has historically preceded recessions.",
    affectedSectors: ["XLF", "XLI"],
    inverseSentiment: false,
  },

  // --- Inflation ---
  {
    seriesId: "CPIAUCSL",
    name: "Consumer Price Index (All Urban Consumers)",
    category: "INFLATION",
    description: "Headline CPI — measures changes in the price level of a basket of consumer goods.",
    affectedSectors: ["XLP", "XLY", "XLE"],
    inverseSentiment: true,
  },
  {
    seriesId: "CPILFESL",
    name: "Core CPI (ex Food & Energy)",
    category: "INFLATION",
    description: "CPI excluding volatile food and energy components — Fed's preferred inflation gauge.",
    affectedSectors: ["XLP", "XLY"],
    inverseSentiment: true,
  },
  {
    seriesId: "PPIACO",
    name: "Producer Price Index (All Commodities)",
    category: "INFLATION",
    description: "Measures average change in selling prices from domestic producers — leading indicator for CPI.",
    affectedSectors: ["XLB", "XLE", "XLI"],
    inverseSentiment: true,
  },

  // --- Employment ---
  {
    seriesId: "UNRATE",
    name: "Unemployment Rate",
    category: "EMPLOYMENT",
    description: "Seasonally adjusted unemployment rate. Rising rate signals labor market weakening.",
    affectedSectors: ["XLY", "XLF", "XLI"],
    inverseSentiment: true,
  },
  {
    seriesId: "PAYEMS",
    name: "Total Nonfarm Payrolls",
    category: "EMPLOYMENT",
    description: "Monthly change in total nonfarm payroll employment — key jobs report metric.",
    affectedSectors: ["XLY", "XLK", "XLI"],
    inverseSentiment: false,
  },

  // --- Growth ---
  {
    seriesId: "GDP",
    name: "Gross Domestic Product",
    category: "GROWTH",
    description: "Quarterly GDP in billions of chained 2017 dollars.",
    affectedSectors: ["XLI", "XLK", "XLY"],
    inverseSentiment: false,
  },
  {
    seriesId: "INDPRO",
    name: "Industrial Production Index",
    category: "GROWTH",
    description: "Monthly index of real output in manufacturing, mining, electric, and gas utilities.",
    affectedSectors: ["XLI", "XLB", "XLE"],
    inverseSentiment: false,
  },

  // --- Credit ---
  {
    seriesId: "BAMLH0A0HYM2",
    name: "ICE BofA US High Yield Option-Adjusted Spread",
    category: "CREDIT",
    description: "High yield credit spread over Treasuries — widens in risk-off environments.",
    affectedSectors: ["XLF", "XLE"],
    inverseSentiment: true,
  },

  // --- Housing ---
  {
    seriesId: "MORTGAGE30US",
    name: "30-Year Fixed Rate Mortgage Average",
    category: "HOUSING",
    description: "Weekly average 30-year mortgage rate — key driver of housing affordability.",
    affectedSectors: ["XLRE", "XLB"],
    inverseSentiment: true,
  },
  {
    seriesId: "HOUST",
    name: "Housing Starts",
    category: "HOUSING",
    description: "Monthly number of privately-owned housing units started.",
    affectedSectors: ["XLRE", "XLB", "XLI"],
    inverseSentiment: false,
  },

  // --- Sentiment ---
  {
    seriesId: "UMCSENT",
    name: "University of Michigan Consumer Sentiment",
    category: "SENTIMENT",
    description: "Monthly survey of consumer attitudes on personal finances and economic conditions.",
    affectedSectors: ["XLY", "XLF"],
    inverseSentiment: false,
  },
];

/** Map from FRED series ID to series definition for O(1) lookup */
export const SERIES_BY_ID = new Map(
  FRED_SERIES.map((s) => [s.seriesId, s])
);
