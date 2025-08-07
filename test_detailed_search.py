#!/usr/bin/env python3
"""Detailed test to understand the deduplication issue"""

from app.services.enhanced_rag_service import EnhancedRAGService

# Initialize the service
rag_service = EnhancedRAGService()
rag_service.initialize()

# Test query
query = "Je dois faire une facette sur la 11"

# Get all ideal sequences from different strategies
print("STRATEGY 1 - Full query search:")
full_query_results = rag_service.search_by_type('ideal_sequence', query, 5)
for i, seq in enumerate(full_query_results):
    print(f"  {i+1}. [{seq['similarity_score']:.3f}] ID: {seq['id']} - '{seq.get('consultation_text', '')}' - {seq['filename']}")

print("\nSTRATEGY 2 - Keyword 'Facette' search:")
facette_results = rag_service.search_by_type('ideal_sequence', 'Facette', 5)
for i, seq in enumerate(facette_results):
    print(f"  {i+1}. [{seq['similarity_score']:.3f}] ID: {seq['id']} - '{seq.get('consultation_text', '')}' - {seq['filename']}")

# Check if IDs are overlapping
full_ids = {seq['id'] for seq in full_query_results}
facette_ids = {seq['id'] for seq in facette_results}
overlap = full_ids & facette_ids
print(f"\nOverlapping IDs: {overlap}")

# Now run the combined search
print("\n" + "="*60)
print("COMBINED SEARCH RESULTS:")
results = rag_service.search_combined_with_sources(query, ideal_results=5)

print(f"\nFinal ideal sequences ({len(results['ideal_sequences'])}):")
for seq in results['ideal_sequences']:
    print(f"  [{seq['similarity_score']:.3f}] (boosted: {seq.get('boosted_score', 0):.3f}) ID: {seq['id']} - '{seq.get('consultation_text', '')}'")