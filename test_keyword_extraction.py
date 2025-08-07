#!/usr/bin/env python3
"""Test keyword extraction to understand the search behavior"""

import logging
logging.basicConfig(level=logging.INFO)

from app.services.enhanced_rag_service import EnhancedRAGService

# Initialize the service
rag_service = EnhancedRAGService()
rag_service.initialize()

test_queries = [
    "Je dois faire une facette sur la 11",
    "Patient a besoin d'un composite angle sur 21",
    "Extraction complexe de deux dents",
    "26 CC + TR"
]

for query in test_queries:
    print(f"\n{'='*60}")
    print(f"Query: '{query}'")
    print("-"*60)
    
    # Extract keywords
    keywords = rag_service._extract_treatment_keywords(query)
    print(f"Extracted keywords: {keywords}")
    
    # Test abbreviation expansion
    expanded = rag_service._expand_abbreviations(query)
    print(f"Expanded query: '{expanded}'")