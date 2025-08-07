#!/usr/bin/env python3
"""Check if the type field is set correctly in search results"""

from app.services.enhanced_rag_service import EnhancedRAGService

# Initialize the service
rag_service = EnhancedRAGService()
rag_service.initialize()

# Test query
query = "facette"

print("Testing search_enhanced_knowledge:")
results = rag_service.search_enhanced_knowledge(query, 5)
for r in results[:3]:
    print(f"  Type: {r.get('type', 'NO TYPE')} - {r.get('filename', '')}")

print("\nTesting search_by_type with 'ideal_sequence':")
results = rag_service.search_by_type('ideal_sequence', query, 5)
for r in results[:3]:
    print(f"  Type: {r.get('type', 'NO TYPE')} - Score: {r.get('similarity_score', 0):.3f} - {r.get('filename', '')}")

print("\nTesting search_combined_with_sources:")
combined = rag_service.search_combined_with_sources(query, ideal_results=3)
print(f"Ideal sequences found: {len(combined['ideal_sequences'])}")
for seq in combined['ideal_sequences']:
    print(f"  Type: {seq.get('type', 'NO TYPE')} - Score: {seq.get('similarity_score', 0):.3f} - {seq.get('filename', '')}")