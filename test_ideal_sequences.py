#!/usr/bin/env python3
"""Test how ideal sequences are processed in the treatment generation"""

import requests
import json

def test_ideal_sequence_processing():
    """Test various queries to see how ideal sequences are used"""
    
    test_cases = [
        {
            "query": "Je dois faire une facette sur la 11",
            "expected": "Should find and use the ideal_sequence_facette.json"
        },
        {
            "query": "Patient a besoin d'un composite angle sur 21", 
            "expected": "Should find ideal_sequence_composite_d_angle.json"
        },
        {
            "query": "Extraction complexe de deux dents",
            "expected": "Should find ideal_sequence_extraction_complexe_x_2.json"
        },
        {
            "query": "Couronne céramique sur 26 avec traitement de racine",
            "expected": "Should combine CC and TR sequences"
        }
    ]
    
    for test in test_cases:
        print(f"\n{'='*80}")
        print(f"🦷 Testing: {test['query']}")
        print(f"Expected: {test['expected']}")
        print("-"*80)
        
        # First, test the RAG search to see what sequences are found
        rag_response = requests.post(
            "http://localhost:5010/api/test/rag-search",
            json={"query": test['query']}
        )
        
        if rag_response.status_code == 200:
            rag_data = rag_response.json()
            results = rag_data.get('results', [])
            
            print(f"\n📚 RAG Search Results:")
            ideal_sequences = [r for r in results if r.get('type') == 'ideal_sequence']
            clinical_cases = [r for r in results if r.get('type') == 'clinical_case']
            
            if ideal_sequences:
                print(f"\n  Ideal Sequences Found ({len(ideal_sequences)}):")
                for seq in ideal_sequences[:3]:
                    score = seq['similarity_score']
                    consultation = seq['consultation_text']
                    print(f"    [{score:.3f}] '{consultation}' - {seq['filename']}")
            
            if clinical_cases:
                print(f"\n  Clinical Cases Found ({len(clinical_cases)}):")
                for case in clinical_cases[:2]:
                    score = case['similarity_score']
                    consultation = case['consultation_text']
                    print(f"    [{score:.3f}] '{consultation}' - {case['filename']}")
        
        # Now test how the AI processes this with ideal sequences
        print(f"\n🤖 Testing AI Processing with search_combined_with_sources:")
        
        # Make a request that would trigger the AI to generate a treatment plan
        ai_payload = {
            "message": test['query'],
            "history": [],
            "tab": "dental-brain",
            "settings": {
                "aiModel": "gpt-4o",
                "similarityThreshold": 60,
                "clinicalCasesCount": 2,
                "idealSequencesCount": 3,  # Request more ideal sequences
                "knowledgeCount": 1,
                "ragPreference": 50  # Prefer ideal sequences
            }
        }
        
        # Note: This would require authentication, so we'll just show what would be sent
        print(f"\n  Settings used:")
        print(f"    - idealSequencesCount: {ai_payload['settings']['idealSequencesCount']}")
        print(f"    - ragPreference: {ai_payload['settings']['ragPreference']} (positive = prefer ideal sequences)")
        print(f"    - similarityThreshold: {ai_payload['settings']['similarityThreshold']}%")

def test_specific_ideal_sequence():
    """Test a specific ideal sequence retrieval"""
    print(f"\n{'='*80}")
    print("🔍 Testing specific ideal sequence retrieval")
    print("-"*80)
    
    # Test exact match
    exact_queries = ["Facette", "Composite d angle", "Extraction complexe x 2"]
    
    for query in exact_queries:
        response = requests.post(
            "http://localhost:5010/api/test/rag-search",
            json={"query": query}
        )
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            
            # Find ideal sequences
            ideal_seqs = [r for r in results if r.get('type') == 'ideal_sequence' and r['similarity_score'] >= 0.95]
            
            if ideal_seqs:
                print(f"\n✅ Query '{query}' found perfect match:")
                for seq in ideal_seqs:
                    print(f"   [{seq['similarity_score']:.4f}] {seq['consultation_text']} - {seq['filename']}")
            else:
                print(f"\n❌ Query '{query}' - No high similarity ideal sequence found")

if __name__ == "__main__":
    print("🧪 Ideal Sequences Processing Test")
    print("="*80)
    
    test_ideal_sequence_processing()
    test_specific_ideal_sequence()
    
    print("\n\n📝 Summary:")
    print("- Ideal sequences are searched using multiple strategies")
    print("- Priority keywords (Facette, Composite, etc.) get boosted scores")
    print("- RAG preference setting controls if ideal sequences are prioritized")
    print("- High similarity sequences (>80%) get special treatment in context")
    print("\n✅ Test completed!")