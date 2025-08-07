#!/usr/bin/env python3
"""
Proposal for redesigning how context is presented to the LLM
"""

# CURRENT ISSUES:
# 1. The 20% boost is artificial and doesn't reflect actual relevance
# 2. Context presentation is too verbose and hierarchical
# 3. Similarity percentages shown to LLM might bias its decisions
# 4. No clear guidance on WHEN to use ideal sequences vs clinical cases

# PROPOSED CONTEXT STRUCTURE:

def proposed_context_format():
    return """
=== ANALYSE DE LA DEMANDE ===
Demande: "Je dois faire une facette sur la 11"
Traitement identifié: Facette
Dent concernée: 11 (Incisive centrale supérieure droite)
Type de cas: Esthétique antérieure

=== RÉFÉRENCES DISPONIBLES ===

🎯 MATCH EXACT - Séquence idéale "Facette"
   ✓ Correspondance parfaite avec votre demande
   ✓ Protocole standardisé et validé
   ⚡ Utiliser cette séquence SAUF si complications spécifiques

📋 CAS CLINIQUE SIMILAIRE - "Plan de TT 12 à 22 F" (68% similaire)
   • Facettes multiples de 12 à 22
   • Plus complexe que votre cas (1 dent vs 6 dents)
   💡 Adapter en simplifiant pour une seule dent

=== SÉQUENCE RECOMMANDÉE ===
Basée sur: Séquence idéale "Facette" (adaptée pour dent unique)

RDV 1: Analyse et préparation
  - Détartrage si nécessaire
  - Empreinte pour wax-up
  - Photos et teinte
  Durée: 45min-1h

RDV 2: Validation esthétique
  - Essai du mock-up
  - Validation avec patient
  - Ajustements si nécessaire
  Durée: 30min
  Délai: 1 semaine

[etc...]

=== POINTS D'ATTENTION ===
• Vérifier l'occlusion
• Considérer blanchiment préalable si autres dents jaunies
• Gouttière de protection recommandée
"""

def improved_decision_logic():
    """
    Nouvelle logique de décision plus intelligente
    """
    rules = {
        "exact_match": {
            "condition": "Consultation text matches exactly (>95%)",
            "action": "Use ideal sequence as primary reference",
            "reason": "Standardized protocol for this exact treatment"
        },
        "high_clinical_match": {
            "condition": "Clinical case >85% similar",
            "action": "Use clinical case as primary reference",
            "reason": "Real-world validated sequence"
        },
        "complex_case": {
            "condition": "Multiple treatments or complications",
            "action": "Combine relevant sequences intelligently",
            "reason": "No single reference covers all aspects"
        },
        "no_good_match": {
            "condition": "No reference >70% similar",
            "action": "Build custom sequence from components",
            "reason": "Unique case requiring custom approach"
        }
    }
    return rules

def smart_boosting_proposal():
    """
    Replace the 20% boost with smarter relevance scoring
    """
    return {
        "exact_treatment_match": 1.5,    # "Facette" query → "Facette" sequence
        "partial_treatment_match": 1.2,  # "Facette 11" → "Facettes multiples"
        "keyword_in_sequence": 1.1,      # Treatment mentioned in steps
        "same_category": 1.0,            # Both are esthetic treatments
        "different_category": 0.8        # Conservative vs surgical
    }

def context_elements_priority():
    """
    What information is most valuable for the LLM?
    """
    return [
        "1. Clear identification of the requested treatment",
        "2. Best matching reference (ideal or clinical)",
        "3. Key differences to consider",
        "4. Specific adaptations needed",
        "5. Critical steps that must not be skipped",
        "6. Common variations based on patient factors"
    ]

# Example of cleaner context presentation
def clean_context_example():
    return """
TRAITEMENT DEMANDÉ: Facette sur dent 11

RÉFÉRENCE PRINCIPALE: Séquence idéale "Facette"
- Protocole standard en 7 RDV
- Inclut option blanchiment (RDV 1-3)
- Durée totale: 4-6 semaines

ADAPTATIONS SUGGÉRÉES:
- Single tooth = réduire durées (mock-up 15min au lieu de 30min)
- Pas de blanchiment demandé = commencer directement au RDV 4

SÉQUENCE FINALE:
1. Préparation + empreinte (1h15)
2. Essai facette (30min) - délai 1 sem
3. Scellement + gouttière (1h) - délai 2 jours
4. Contrôle post-op (15min) - délai 1 sem
"""

if __name__ == "__main__":
    print("CONTEXT REDESIGN PROPOSAL")
    print("="*60)
    print("\n1. PROPOSED NEW FORMAT:")
    print(proposed_context_format())
    print("\n2. DECISION LOGIC:")
    for rule, details in improved_decision_logic().items():
        print(f"\n{rule}:")
        for k, v in details.items():
            print(f"  {k}: {v}")
    print("\n3. SMART BOOSTING:")
    for boost_type, multiplier in smart_boosting_proposal().items():
        print(f"  {boost_type}: {multiplier}x")