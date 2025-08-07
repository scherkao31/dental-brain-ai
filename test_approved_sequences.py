#!/usr/bin/env python3
"""Test script to debug approved sequences search"""

import os
import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from app import create_app
from app.services.enhanced_rag_service import EnhancedRAGService

def test_approved_sequences():
    """Test if approved sequences are being found"""
    app = create_app()
    
    with app.app_context():
        # Initialize the RAG service
        rag_service = EnhancedRAGService()
        rag_service.initialize()
            
        print("🔍 Testing approved sequences search...")
        
        # Test query
        query = "26 CC"
        print(f"\nSearching for: '{query}'")
        
        # Search using the combined search
        results = rag_service.search_combined_with_sources(query, case_results=5, ideal_results=5)
        
        print(f"\n📊 Results summary:")
        print(f"- Clinical cases: {len(results.get('clinical_cases', []))}")
        print(f"- Approved sequences: {len(results.get('approved_sequences', []))}")
        print(f"- Ideal sequences: {len(results.get('ideal_sequences', []))}")
        print(f"- General knowledge: {len(results.get('general_knowledge', []))}")
        
        # Show approved sequences details
        approved = results.get('approved_sequences', [])
        if approved:
            print(f"\n✅ Found {len(approved)} approved sequences:")
            for seq in approved:
                print(f"  - Title: {seq.get('title', 'No title')}")
                print(f"    Score: {seq.get('similarity_score', 0):.3f}")
                print(f"    Consultation: {seq.get('consultation_text', 'N/A')}")
                print(f"    ID: {seq.get('id', 'N/A')}")
                print()
        else:
            print("\n❌ No approved sequences found!")
            
        # Test specific search for approved sequences
        print("\n🔍 Testing direct approved sequence search...")
        approved_direct = rag_service.search_by_type('approved_sequence', query, 5)
        print(f"Direct search found: {len(approved_direct)} results")
        
        for seq in approved_direct[:3]:
            print(f"  - {seq.get('title', 'No title')} (score: {seq.get('similarity_score', 0):.3f})")

if __name__ == "__main__":
    test_approved_sequences()