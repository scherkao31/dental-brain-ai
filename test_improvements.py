#!/usr/bin/env python3
"""Test the improved boosting logic and context formatting"""

import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(message)s'
)

from app.services.enhanced_rag_service import EnhancedRAGService
from app.services.ai_service import AIService

# Initialize services
rag_service = EnhancedRAGService()
rag_service.initialize()
ai_service = AIService(rag_service)

# Test queries
test_queries = [
    ("Facette", "Should get 2x boost for exact match"),
    ("Je dois faire une facette sur la 11", "Should identify Facette keyword and boost it"),
    ("Composite angle", "Should get high boost for 'Composite d angle'"),
]

print("="*80)
print("TESTING IMPROVED BOOSTING LOGIC")
print("="*80)

for query, expected in test_queries:
    print(f"\n🔍 Query: '{query}'")
    print(f"Expected: {expected}")
    print("-"*60)
    
    # Search with combined sources
    results = rag_service.search_combined_with_sources(query, ideal_results=3)
    
    print("\nIdeal Sequences Found:")
    for seq in results['ideal_sequences']:
        # Get consultation text from enhanced_data
        enhanced_data = seq.get('enhanced_data', {})
        consultation = enhanced_data.get('consultation_text', seq.get('consultation_text', ''))
        
        base_score = seq['similarity_score']
        boosted_score = seq.get('boosted_score', base_score)
        boost_reason = seq.get('boost_reason', 'none')
        
        print(f"\n  '{consultation}' ({seq.get('filename', '')})")
        print(f"  Base Score: {base_score:.3f}")
        print(f"  Boosted Score: {boosted_score:.3f}")
        print(f"  Boost Reason: {boost_reason}")
        
        if boost_reason == 'exact_match':
            print("  🎯 EXACT MATCH - 2x boost applied!")
        elif boost_reason == 'primary_treatment':
            print("  ⭐ PRIMARY TREATMENT - 1.5x boost applied!")

print("\n" + "="*80)
print("TESTING IMPROVED CONTEXT FORMATTING")
print("="*80)

# Get the dental brain LLM
dental_brain = ai_service.specialized_llms.get('dental-brain')

# Test context generation
test_message = "Je dois faire une facette sur la 11"
settings = {
    'similarityThreshold': 60,
    'clinicalCasesCount': 2,
    'idealSequencesCount': 3,
    'knowledgeCount': 1
}

print(f"\n🦷 Generating context for: '{test_message}'")
print("-"*60)

# Get specialized context
rag_results, context = dental_brain.get_specialized_context(test_message, settings)

# Show the formatted context
print("\nGENERATED CONTEXT:")
print(context)

print("\n✅ Test completed!")