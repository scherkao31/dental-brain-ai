#!/usr/bin/env python3
"""Test search with detailed logging"""

import logging
# Set up logging to see what's happening
logging.basicConfig(
    level=logging.INFO,
    format='%(name)s - %(levelname)s - %(message)s'
)

from app.services.enhanced_rag_service import EnhancedRAGService

# Initialize the service
rag_service = EnhancedRAGService()
rag_service.initialize()

# Test a specific query
query = "Je dois faire une facette sur la 11"
print(f"\nTesting query: '{query}'")
print("="*60)

# Run the search
results = rag_service.search_combined_with_sources(
    query,
    case_results=3,
    ideal_results=3,
    knowledge_results=0
)

print(f"\n\nFINAL RESULTS:")
print(f"Ideal Sequences ({len(results['ideal_sequences'])}):")
for seq in results['ideal_sequences']:
    print(f"  [{seq['similarity_score']:.3f}] '{seq.get('consultation_text', '')}' - {seq['filename']}")
    if 'boosted_score' in seq:
        print(f"         Boosted: {seq['boosted_score']:.3f}")