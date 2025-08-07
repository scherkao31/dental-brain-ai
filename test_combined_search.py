#!/usr/bin/env python3
"""Test the search_combined_with_sources method directly"""

from app.services.enhanced_rag_service import EnhancedRAGService

# Initialize the service
rag_service = EnhancedRAGService()
rag_service.initialize()

test_queries = [
    "Je dois faire une facette sur la 11",
    "Patient a besoin d'un composite angle sur 21",
    "facette",
    "composite angle"
]

for query in test_queries:
    print(f"\n{'='*60}")
    print(f"Query: '{query}'")
    print("-"*60)
    
    # Search using the combined method (as used by AI service)
    results = rag_service.search_combined_with_sources(
        query,
        case_results=3,
        ideal_results=3,
        knowledge_results=2
    )
    
    print(f"\nIdeal Sequences Found: {len(results['ideal_sequences'])}")
    for seq in results['ideal_sequences']:
        print(f"  [{seq['similarity_score']:.3f}] '{seq.get('consultation_text', seq['title'])}' - {seq['filename']}")
        if 'boosted_score' in seq:
            print(f"         Boosted score: {seq['boosted_score']:.3f}")
    
    print(f"\nClinical Cases Found: {len(results['clinical_cases'])}")
    for case in results['clinical_cases'][:2]:
        print(f"  [{case['similarity_score']:.3f}] '{case.get('consultation_text', case['title'])}'")