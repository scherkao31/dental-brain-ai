#!/usr/bin/env python3
"""Test RAG initialization"""

import os
import sys
from dotenv import load_dotenv

# Add the app directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Import the RAG service
from app.services.enhanced_rag_service import EnhancedRAGService

# Create and initialize the service
print("Creating EnhancedRAGService...")
rag_service = EnhancedRAGService()

print(f"Before initialize - enhanced_collection: {rag_service.enhanced_collection}")
print(f"Before initialize - enhanced_knowledge_base: {rag_service.enhanced_knowledge_base}")

# Initialize
print("\nCalling initialize()...")
result = rag_service.initialize()
print(f"Initialize result: {result}")

print(f"\nAfter initialize - enhanced_collection: {rag_service.enhanced_collection}")
print(f"After initialize - enhanced_knowledge_base: {type(rag_service.enhanced_knowledge_base)}")

if rag_service.enhanced_collection:
    print(f"Collection count: {rag_service.enhanced_collection.count()}")
    
    # Try to search for approved sequences
    approved_results = rag_service.search_by_type('approved_sequence', '26 CC', 5)
    print(f"\nApproved sequences for '26 CC': {len(approved_results)}")
    for seq in approved_results:
        print(f"  - {seq.get('title', 'No title')} (score: {seq.get('similarity_score', 0):.3f})")