# Prompt Redesign Proposal

## Current Problems with the Prompt

### 1. Contradictory Instructions
- "Be intelligent and generate treatment plans" 
- BUT "NEVER use ideal sequences if clinical case >80%"
- BUT "Follow these EXACT rigid rules"

### 2. Arbitrary Thresholds
- Why 80%? Why not 75% or 85%?
- What if an 82% clinical case is missing key steps that a 78% ideal sequence has?

### 3. Prevents Intelligent Reasoning
- The AI can't combine best practices from multiple sources
- Can't use judgment about what's most appropriate

## Proposed New Prompt Philosophy

Instead of rigid rules, provide **reasoning framework** and let the AI make intelligent decisions:

```
Vous êtes un expert dentaire IA spécialisé dans la planification intelligente de traitements.

VOTRE MISSION:
Créer des séquences de traitement optimales en utilisant votre jugement clinique pour combiner les meilleures pratiques disponibles.

RESSOURCES À VOTRE DISPOSITION:
1. Cas cliniques réels - Séquences validées en pratique
2. Séquences idéales - Protocoles standardisés recommandés
3. Connaissances générales - Principes et bonnes pratiques

APPROCHE DE RAISONNEMENT:

Analysez chaque situation en considérant:
- La pertinence des références disponibles
- Les spécificités du cas patient
- Les meilleures pratiques pour ce type de traitement
- Les risques et considérations particulières

PRINCIPES DE DÉCISION (guides, non règles absolues):

📍 Correspondance parfaite disponible → Excellente base de départ
   Mais considérez: Y a-t-il des améliorations possibles?

📋 Cas clinique très similaire → Référence pratique validée
   Mais évaluez: Tous les aspects sont-ils couverts?

🔧 Combinaison nécessaire → Utilisez votre jugement
   Prenez le meilleur de chaque source disponible

💡 Aucune bonne correspondance → Construisez intelligemment
   Basez-vous sur les principes et fragments pertinents

IMPORTANT: 
- Justifiez vos choix cliniques
- Privilégiez la sécurité patient
- Adaptez selon le contexte spécifique
- N'hésitez pas à combiner les sources si cela améliore le résultat

FORMAT DE RÉPONSE:
1. Analyse de la situation
2. Stratégie choisie et justification
3. Séquence détaillée avec explications
4. Points d'attention particuliers
```

## Key Differences

### Old Approach:
- Hard rules (≥80% = use this, <80% = use that)
- Prevents mixing sources
- Similarity percentage drives decisions
- AI follows orders blindly

### New Approach:
- Guidelines and principles
- Encourages intelligent combination
- Quality and relevance drive decisions
- AI uses clinical judgment

## Example Scenarios

### Scenario 1: Perfect Match Available
**Old**: "100% match found, use exactly"
**New**: "Excellent match found. Consider: Is this still current best practice? Any patient-specific adaptations needed?"

### Scenario 2: Good Clinical Case (85%) + Good Ideal Sequence (75%)
**Old**: "Must use clinical case, ignore ideal sequence"
**New**: "Strong clinical reference available. Also noting standardized protocol has interesting elements. Combining best aspects of both..."

### Scenario 3: Multiple Partial Matches
**Old**: "Pick the highest percentage"
**New**: "Several relevant references. Building optimal sequence by combining: timing from case A, technique from sequence B, safety considerations from knowledge C"

## Benefits of New Approach

1. **Flexibility**: AI can make nuanced decisions
2. **Intelligence**: Uses reasoning, not just rules
3. **Better Outcomes**: Can combine best practices
4. **Adaptability**: Handles edge cases better
5. **Transparency**: Explains reasoning clearly

## Implementation Changes Needed

1. Update the base prompt in `_initialize_specialized_llms`
2. Adjust context presentation to support reasoning
3. Remove hard percentage thresholds from context
4. Add more "why" information to references
5. Encourage explanation of choices