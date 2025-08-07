# How Ideal Sequences are Processed in the Dental AI System

## Overview
The system processes ideal sequences through a sophisticated multi-strategy search and ranking system, optimized for consultation-text matching.

## 1. Indexing Strategy (Optimized)
- **What's indexed**: ONLY consultation texts (e.g., "Facette", "Composite d angle")
- **Format**: Both original and expanded forms are indexed together
  - Example: "26 CC + TR" → "26 CC + TR\n26 Couronne céramique + Traitement de racine"
- **Result**: Perfect matches when dentists use exact terminology

## 2. Search Process (search_combined_with_sources)

### Strategy 1: Full Query Search
- Searches ideal sequences with the complete user query
- Example: "Je dois faire une facette sur la 11" → finds "Facette" with ~0.489 similarity
- No boost applied to these results

### Strategy 2: Keyword Extraction & Search
- Extracts treatment keywords from the query:
  - Common treatments: 'facette', 'composite', 'couronne', etc.
  - Abbreviations: 'CC' → 'Couronne céramique', 'TR' → 'Traitement de racine'
  - Tooth numbers: '11' → 'Incisive centrale supérieure droite'
  
- Priority keywords (actual treatments) get:
  - Separate searches
  - 20% score boost (1.2x multiplier)
  - Example: "Facette" keyword → finds "Facette" with 1.000 similarity → 1.200 boosted score

### Deduplication
- Fixed to keep the version with the highest boosted score
- Prevents losing high-scoring keyword matches

### Final Ranking
- Sequences sorted by boosted score
- Top N results returned based on settings

## 3. Context Generation for LLM

### Priority Rules
1. **Clinical cases ≥90%**: Use EXACTLY
2. **Clinical cases ≥80%**: Follow closely  
3. **Ideal sequences**: Only when no clinical case ≥80%

### How Ideal Sequences Appear in Context
```
=== SÉQUENCES IDÉALES ===
[95% similaire] Facette:
Source: sequence de_traitement_ideal_1.docx
SÉQUENCE COMPLÈTE À SUIVRE:
  RDV 1: Détartrage + empreinte pour blanchiment et wax-up + clés (1h)
  RDV 2: Mock-up Donner gouttières de blanchiment + gel (15 min)
    Délai: 1 sem
  ...
```

## 4. Current Performance

### What Works Well
- **Exact matches**: "Facette" → 100% match with ideal_sequence_facette.json
- **Abbreviation handling**: "Composite d angle" → "Composite Distal angle"
- **Keyword boosting**: Priority treatments get higher scores

### Areas for Improvement
1. **Complex queries**: "Je dois faire une facette sur la 11" doesn't match as well as "facette"
2. **Multi-treatment queries**: "26 CC + TR" needs better handling
3. **Context understanding**: Could benefit from semantic analysis

## 5. Settings That Affect Ideal Sequences

- **idealSequencesCount**: How many ideal sequences to retrieve (default: 2)
- **ragPreference**: 
  - Negative (-100 to -20): Prefer clinical cases
  - Neutral (-20 to 20): Balanced
  - Positive (20 to 100): Prefer ideal sequences
- **similarityThreshold**: Minimum similarity to include (default: 60%)

## 6. Example Search Flow

Query: "Je dois faire une facette sur la 11"

1. **Full query search**: Finds sequences with medium similarity
2. **Keyword extraction**: ["Facette", "11", "Incisive centrale supérieure droite"]
3. **Keyword search**: "Facette" finds ideal_sequence_facette.json with 1.000 similarity
4. **Boosting**: 1.000 × 1.2 = 1.200 boosted score
5. **Final ranking**: Facette sequence appears first

## 7. Recommendations for Best Results

1. **Use specific treatment terms** in queries for better matching
2. **Set ragPreference positive** when you want to prioritize ideal sequences
3. **Increase idealSequencesCount** to get more sequence options
4. **Lower similarityThreshold** if you want more diverse results