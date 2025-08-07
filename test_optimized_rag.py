#!/usr/bin/env python3
"""Test the optimized RAG with consultation-only embeddings"""

import requests
import json

def test_rag_optimization():
    """Test various queries to verify consultation-only matching"""
    
    test_cases = [
        {
            "query": "Facette",
            "expected": "Should match exactly with 'Facette' consultation text"
        },
        {
            "query": "12 à 22 F", 
            "expected": "Should match exactly with '12 à 22 F' from treatment_planning_2.json"
        },
        {
            "query": "26 CC + TR",
            "expected": "Should match with '26 dém. CC + dém. tenons + TR 3 canaux + MA + CC'"
        },
        {
            "query": "Extraction complexe x 2",
            "expected": "Should match exactly"
        },
        {
            "query": "Composite d angle",
            "expected": "Should match exactly"
        }
    ]
    
    for test in test_cases:
        print(f"\n{'='*60}")
        print(f"🔍 Testing: {test['query']}")
        print(f"Expected: {test['expected']}")
        print("-"*60)
        
        response = requests.post(
            "http://localhost:5010/api/test/rag-search",
            json={"query": test['query']}
        )
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            
            # Show top 3 results
            print(f"\nTop {min(3, len(results))} results:")
            for i, result in enumerate(results[:3]):
                score = result['similarity_score']
                consultation = result['consultation_text']
                expanded = result['consultation_text_expanded']
                
                # Highlight perfect or near-perfect matches
                if score >= 0.99:
                    print(f"\n  🎯 PERFECT MATCH [{score:.4f}]")
                elif score >= 0.95:
                    print(f"\n  ⭐ HIGH MATCH [{score:.4f}]")
                else:
                    print(f"\n  📍 Result {i+1} [{score:.4f}]")
                
                print(f"     Original: '{consultation}'")
                if consultation != expanded:
                    print(f"     Expanded: '{expanded}'")
                print(f"     File: {result['filename']}")
            
            high_matches = data.get('high_matches_count', 0)
            if high_matches > 0:
                print(f"\n✅ Found {high_matches} high similarity matches (≥0.95)")
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)

if __name__ == "__main__":
    print("🧪 RAG Optimization Test - Consultation-Only Embeddings")
    print("="*60)
    test_rag_optimization()
    print("\n✅ Test completed!")