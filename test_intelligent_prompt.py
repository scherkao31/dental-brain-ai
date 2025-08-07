#!/usr/bin/env python3
"""Test the new intelligent prompt approach"""

from app.services.enhanced_rag_service import EnhancedRAGService
from app.services.ai_service import AIService

# Initialize services
rag_service = EnhancedRAGService()
rag_service.initialize()
ai_service = AIService(rag_service)

# Get the dental brain LLM
dental_brain = ai_service.specialized_llms.get('dental-brain')

# Test scenario: Query that has both good clinical case and ideal sequence
test_query = "Facette sur 11"
settings = {
    'similarityThreshold': 60,
    'clinicalCasesCount': 3,
    'idealSequencesCount': 3,
    'knowledgeCount': 0
}

print("="*80)
print("TESTING NEW INTELLIGENT PROMPT APPROACH")
print("="*80)
print(f"\nQuery: '{test_query}'")
print("-"*60)

# Get context
rag_results, context = dental_brain.get_specialized_context(test_query, settings)

# Show the context
print("\nGENERATED CONTEXT:")
print(context)

# Show part of the prompt
print("\n" + "="*80)
print("KEY DIFFERENCES IN NEW PROMPT:")
print("="*80)

print("\n❌ OLD APPROACH (Rigid Rules):")
print("""
- CAS CLINIQUES ≥ 80%: Utiliser EXCLUSIVEMENT
- NE JAMAIS mélanger avec séquences idéales
- Suivre ces règles EXACTEMENT
""")

print("\n✅ NEW APPROACH (Intelligent Reasoning):")
print("""
- Évaluez la pertinence de chaque référence
- Combinez intelligemment les meilleures pratiques  
- Adaptez selon le contexte particulier
- Justifiez vos choix cliniques
""")

print("\n" + "="*80)
print("EXAMPLE SCENARIOS")
print("="*80)

scenarios = [
    {
        "situation": "Cas clinique 85% + Séquence idéale 95%",
        "old": "MUST use clinical case only, ignore ideal sequence",
        "new": "Consider both: clinical for real-world validation, ideal for optimized protocol"
    },
    {
        "situation": "Multiple partial matches (70-75%)",
        "old": "Can't use any - all below 80% threshold",
        "new": "Combine best elements from each to create optimal sequence"
    },
    {
        "situation": "Perfect ideal sequence but with old technique",
        "old": "Use exactly as is - it's 100% match",
        "new": "Use as base but update technique to current best practice"
    }
]

for scenario in scenarios:
    print(f"\n📌 {scenario['situation']}")
    print(f"   Old: {scenario['old']}")
    print(f"   New: {scenario['new']}")

print("\n✅ The AI can now make intelligent, nuanced decisions!")