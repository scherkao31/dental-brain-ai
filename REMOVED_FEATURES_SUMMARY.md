# Removed Features Summary

## Features Removed

### 1. Financial Analysis Tab ("Analyse financière")
- Removed the financial analysis tab from treatment plans
- Commented out all financial calculation functions
- Removed financial charts (profit breakdown, cost distribution)
- Removed financial summary cards (revenue, costs, profit)
- Removed financial breakdown tables
- Removed the "showFinancialAnalysis" setting from preferences

### 2. Optimization Features ("Optimisé")
- Removed the "Optimisé" tab from treatment plans
- Removed the "Optimiser" button from the toolbar
- Commented out optimizeTreatmentPlan functionality
- Removed financial optimization slider
- Removed optimization impact calculations
- Removed optimized versions display

## Files Modified

### inline-treatment.js
- Removed tabs: "Analyse financière" and "Version optimisée" 
- Commented out functions:
  - `generateFinanceContent()`
  - `generateOptimizedContent()`
  - `optimizeTreatmentPlan()`
  - `optimizeFinancially()`
  - `initializeFinancialCharts()`
  - `generateBreakdownTable()` (kept but unused)

### chat-app.js
- Commented out functions:
  - `generateFinancialAnalysisHTML()`
  - `initializeFinancialCharts()`
  - `optimizeTreatmentSequence()`
  - `updateFinancialDisplay()`
  - `resetOptimization()`
- Removed financial analysis section from treatment plan display

### chat.html
- Removed "showFinancialAnalysis" checkbox from settings

### Modular files (not active but cleaned):
- state.js: Removed showFinancialAnalysis from default settings
- app.js: Removed references to showFinancialAnalysis

## What Remains

The app now focuses on:
1. **Treatment Sequences** - Core treatment planning functionality
2. **RAG References** - Clinical cases and knowledge base references
3. **Basic Settings** - Theme, RAG preferences, display options

## Notes

- All code has been commented out rather than deleted to allow easy restoration if needed
- The pricing-config.js file was already removed in an earlier cleanup
- No backend endpoints for optimization were found (may have been client-side only)
- The app is now more focused on core dental treatment planning without financial complexity