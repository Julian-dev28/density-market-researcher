// ============================================================
// Foundry Ontology Schema Registry
//
// Defines Object Types and Link Types for the macro research
// Ontology. Use this as the spec when creating Object Types
// in Foundry's Ontology Manager.
//
// Ontology graph:
//
//   MacroIndicator ──[sector_macro_driver]──► SectorSnapshot
//                                                  │
//                                    [company_in_sector]
//                                                  │
//                                                  ▼
//                                         WatchlistCompany
//
//   CryptoMetric ──[crypto_category_driver]──► CategorySnapshot
// ============================================================

export const OBJECT_TYPES = {
  MACRO_INDICATOR: {
    apiName: "macro_indicator",
    displayName: "Macro Indicator",
    primaryKeyProperty: "seriesId",
    rid: process.env.FOUNDRY_MACRO_INDICATOR_RID ?? "",
    properties: {
      seriesId:         { type: "string",    displayName: "Series ID" },
      name:             { type: "string",    displayName: "Name" },
      source:           { type: "string",    displayName: "Source" },
      category:         { type: "string",    displayName: "Category" },
      latestValue:      { type: "double",    displayName: "Latest Value" },
      latestDate:       { type: "date",      displayName: "Latest Date" },
      unit:             { type: "string",    displayName: "Unit" },
      priorValue:       { type: "double",    displayName: "Prior Value" },
      priorDate:        { type: "date",      displayName: "Prior Date" },
      periodDelta:      { type: "double",    displayName: "Period Delta" },
      periodDeltaPct:   { type: "double",    displayName: "Period Delta %" },
      yearLow:          { type: "double",    displayName: "52-Week Low" },
      yearHigh:         { type: "double",    displayName: "52-Week High" },
      yearPercentile:   { type: "double",    displayName: "52-Week Percentile" },
      signal:           { type: "string",    displayName: "Signal" },
      signalRationale:  { type: "string",    displayName: "Signal Rationale" },
      frequency:        { type: "string",    displayName: "Frequency" },
      lastUpdated:      { type: "string",    displayName: "Last Updated" },
      sourceUrl:        { type: "string",    displayName: "Source URL" },
    },
  },

  SECTOR_SNAPSHOT: {
    apiName: "sector_snapshot",
    displayName: "Sector Snapshot",
    primaryKeyProperty: "snapshotId",
    rid: process.env.FOUNDRY_SECTOR_SNAPSHOT_RID ?? "",
    properties: {
      snapshotId:             { type: "string",    displayName: "Snapshot ID" },
      sectorTicker:           { type: "string",    displayName: "Sector ETF Ticker" },
      sectorName:             { type: "string",    displayName: "Sector Name" },
      date:                   { type: "date",      displayName: "Date" },
      dayChangePct:           { type: "double",    displayName: "1-Day Change %" },
      weekChangePct:          { type: "double",    displayName: "5-Day Change %" },
      monthChangePct:         { type: "double",    displayName: "1-Month Change %" },
      ytdChangePct:           { type: "double",    displayName: "YTD Change %" },
      relativeStrengthVsSPY:  { type: "double",    displayName: "Relative Strength vs SPY %" },
      macroRegime:            { type: "string",    displayName: "Macro Regime" },
      primaryMacroDrivers:    { type: "string",    displayName: "Primary Macro Drivers (JSON)" },
      sectorSignal:           { type: "string",    displayName: "Signal" },
      signalRationale:        { type: "string",    displayName: "Signal Rationale" },
      ingestedAt:             { type: "timestamp", displayName: "Ingested At" },
    },
  },

  CRYPTO_METRIC: {
    apiName: "crypto_metric",
    displayName: "Crypto Metric",
    primaryKeyProperty: "metricId",
    rid: process.env.FOUNDRY_CRYPTO_METRIC_RID ?? "",
    properties: {
      metricId:         { type: "string",    displayName: "Metric ID" },
      name:             { type: "string",    displayName: "Name" },
      category:         { type: "string",    displayName: "Category" },
      source:           { type: "string",    displayName: "Source" },
      unit:             { type: "string",    displayName: "Unit" },
      latestValue:      { type: "double",    displayName: "Latest Value" },
      latestDate:       { type: "date",      displayName: "Latest Date" },
      priorValue:       { type: "double",    displayName: "Prior Value" },
      periodDelta:      { type: "double",    displayName: "Period Delta" },
      periodDeltaPct:   { type: "double",    displayName: "Period Delta %" },
      signal:           { type: "string",    displayName: "Signal" },
      signalRationale:  { type: "string",    displayName: "Signal Rationale" },
      lastUpdated:      { type: "string",    displayName: "Last Updated" },
    },
  },

  CATEGORY_SNAPSHOT: {
    apiName: "category_snapshot",
    displayName: "Category Snapshot",
    primaryKeyProperty: "snapshotId",
    rid: process.env.FOUNDRY_CATEGORY_SNAPSHOT_RID ?? "",
    properties: {
      snapshotId:             { type: "string",    displayName: "Snapshot ID" },
      categoryName:           { type: "string",    displayName: "Category Name" },
      categorySlug:           { type: "string",    displayName: "Category Slug" },
      totalMarketCapUsd:      { type: "double",    displayName: "Total Market Cap (USD)" },
      dayChangePct:           { type: "double",    displayName: "1-Day Change %" },
      dominancePct:           { type: "double",    displayName: "Dominance %" },
      cryptoRegime:           { type: "string",    displayName: "Crypto Regime" },
      primaryMetricDrivers:   { type: "string",    displayName: "Primary Metric Drivers (JSON)" },
      categorySignal:         { type: "string",    displayName: "Signal" },
      signalRationale:        { type: "string",    displayName: "Signal Rationale" },
      ingestedAt:             { type: "timestamp", displayName: "Ingested At" },
    },
  },

  WATCHLIST_COMPANY: {
    apiName: "watchlist_company",
    displayName: "Watchlist Company",
    primaryKeyProperty: "ticker",
    rid: process.env.FOUNDRY_WATCHLIST_COMPANY_RID ?? "",
    properties: {
      ticker:               { type: "string",    displayName: "Ticker" },
      name:                 { type: "string",    displayName: "Company Name" },
      sectorTicker:         { type: "string",    displayName: "Sector ETF" },
      subIndustry:          { type: "string",    displayName: "Sub-Industry" },
      marketCapBn:          { type: "double",    displayName: "Market Cap ($B)" },
      rateSensitivity:      { type: "double",    displayName: "Rate Sensitivity (0-1)" },
      inflationSensitivity: { type: "double",    displayName: "Inflation Sensitivity (0-1)" },
      usdSensitivity:       { type: "double",    displayName: "USD Sensitivity (0-1)" },
      analystNotes:         { type: "string",    displayName: "Analyst Notes" },
      addedAt:              { type: "timestamp", displayName: "Added At" },
      lastReviewedAt:       { type: "timestamp", displayName: "Last Reviewed At" },
    },
  },
} as const;

export const LINK_TYPES = {
  SECTOR_MACRO_DRIVER: {
    apiName: "sector_macro_driver",
    displayName: "Sector Driven By Macro Indicator",
    objectTypeA: OBJECT_TYPES.SECTOR_SNAPSHOT.apiName,
    objectTypeB: OBJECT_TYPES.MACRO_INDICATOR.apiName,
    cardinality: "MANY_TO_MANY" as const,
  },
  COMPANY_IN_SECTOR: {
    apiName: "company_in_sector",
    displayName: "Company In Sector",
    objectTypeA: OBJECT_TYPES.WATCHLIST_COMPANY.apiName,
    objectTypeB: OBJECT_TYPES.SECTOR_SNAPSHOT.apiName,
    cardinality: "MANY_TO_MANY" as const,
  },
  CRYPTO_CATEGORY_DRIVER: {
    apiName: "crypto_category_driver",
    displayName: "Category Driven By Crypto Metric",
    objectTypeA: OBJECT_TYPES.CATEGORY_SNAPSHOT.apiName,
    objectTypeB: OBJECT_TYPES.CRYPTO_METRIC.apiName,
    cardinality: "MANY_TO_MANY" as const,
  },
} as const;
