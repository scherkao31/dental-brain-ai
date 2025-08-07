# Context Presentation Analysis & Improvement Proposal

## Current Issues

### 1. The 20% Boost Problem
- **Current**: All priority keywords get a flat 1.2x multiplier
- **Issue**: "Facette" keyword finding "Facette" sequence gets same boost as "Composite" finding any composite sequence
- **Not Smart Because**: Exact matches should get much higher boost than partial matches

### 2. Verbose Context Presentation
```
Current format:
=== SÉQUENCES IDÉALES ===
[95% similaire] ideal sequence facette - Facette:
Source: sequence de_traitement_ideal_1.docx
SÉQUENCE COMPLÈTE À SUIVRE:
  RDV 1: Détartrage + empreinte pour blanchiment et wax-up + clés (1h)
  RDV 2: Mock-up Donner gouttières de blanchiment + gel (15 min)
    Délai: 1 sem
  [... 5 more appointments ...]
```

**Issues**:
- Too much raw data dumped on the LLM
- No analysis or guidance on how to use it
- Similarity percentages might create bias

### 3. Poor Decision Guidance
- Current prompt says "use clinical cases >80%" but doesn't explain WHY
- No guidance on how to adapt sequences
- No clear framework for combining multiple references

## Proposed Improvements

### 1. Smarter Relevance Scoring

```python
def calculate_relevance_score(query, result):
    base_score = result['similarity_score']
    
    # Exact consultation text match
    if query.lower().strip() == result['consultation_text'].lower().strip():
        return base_score * 2.0  # 100% boost for exact match
    
    # Treatment type matches
    query_treatments = extract_treatments(query)
    result_treatments = extract_treatments(result['consultation_text'])
    
    if set(query_treatments) == set(result_treatments):
        return base_score * 1.5  # 50% boost for same treatments
    elif any(t in result_treatments for t in query_treatments):
        return base_score * 1.2  # 20% boost for partial match
    
    return base_score
```

### 2. Structured Context with Analysis

```python
def generate_smart_context(query, search_results):
    # Analyze the query first
    analysis = analyze_query(query)
    
    # Find best matches
    best_ideal = find_best_match(search_results['ideal_sequences'])
    best_clinical = find_best_match(search_results['clinical_cases'])
    
    # Generate structured context
    context = f"""
=== ANALYSE DE LA DEMANDE ===
Traitement principal: {analysis['main_treatment']}
Complexité: {analysis['complexity']}  # Simple/Moyenne/Complexe
Éléments spécifiques: {analysis['specifics']}

=== STRATÉGIE RECOMMANDÉE ===
{generate_strategy(best_ideal, best_clinical, analysis)}

=== SÉQUENCE DE BASE ===
{format_recommended_sequence(best_match, analysis)}

=== ADAPTATIONS NÉCESSAIRES ===
{list_required_adaptations(query, best_match)}
"""
    return context
```

### 3. Clear Decision Framework

Instead of rigid percentage rules, provide intelligent guidance:

```
FRAMEWORK DE DÉCISION:

1. MATCH PARFAIT (>95% sur consultation text)
   → Utiliser directement la séquence
   → Adapter seulement pour spécificités patient

2. MATCH ÉLEVÉ (80-95%)
   → Utiliser comme base principale
   → Identifier différences clés
   → Adapter systématiquement

3. MATCHES MULTIPLES (plusieurs >70%)
   → Combiner intelligemment
   → Prendre meilleur de chaque séquence
   → Valider cohérence globale

4. PAS DE BON MATCH (<70%)
   → Construire from scratch
   → S'inspirer des meilleures pratiques
   → Extra prudence sur durées/délais
```

### 4. Improved Context Elements

**Remove**:
- Raw similarity percentages (create bias)
- Full sequence dumps for low-relevance matches
- Redundant source information

**Add**:
- Clear treatment analysis
- Specific adaptation guidance
- Risk factors to consider
- Common variations

**Example of Improved Context**:

```
DEMANDE: Facette sur 11

ANALYSE:
- Traitement unique, esthétique antérieure
- Cas simple sans complications mentionnées
- Match parfait avec séquence idéale "Facette"

RECOMMANDATION:
Utiliser séquence idéale "Facette" en 4 RDV (sans blanchiment)
ou 7 RDV (avec blanchiment préalable)

ADAPTATIONS POUR DENT UNIQUE:
- Mock-up plus rapide (15min vs 30min)
- Empreinte finale simplifiée
- Coût réduit proportionnellement

SÉQUENCE OPTIMISÉE:
1. Préparation + empreinte + provisoire (1h15)
2. Essai facette (30min) - attendre 1 semaine
3. Scellement + gouttière (1h) - attendre 2 jours
4. Contrôle (15min) - après 1 semaine

POINTS CRITIQUES:
✓ Valider teinte avant préparation
✓ Mock-up obligatoire pour validation
✓ Gouttière de protection nocturne
```

## Implementation Priority

1. **High Priority**: Fix the boosting logic to be smarter
2. **High Priority**: Restructure context to be analytical, not just data dumping
3. **Medium Priority**: Remove similarity percentages from LLM view
4. **Medium Priority**: Add adaptation guidance
5. **Low Priority**: Add risk factors and variations

## Expected Benefits

1. **Better Sequence Selection**: Smarter boosting = better matches
2. **Improved Adaptations**: Clear guidance on how to modify sequences
3. **Reduced Hallucination**: Less raw data, more structured guidance
4. **Faster Generation**: Cleaner context = faster processing
5. **More Consistent Results**: Clear framework = predictable outputs