#!/usr/bin/env python3
"""Test script to verify RAG optimization with consultation-only embeddings"""

import requests
import json

# Test queries that should get high similarity scores
test_queries = [
    "Facette",  # Should match exactly with ideal_sequence_facette.json
    "12 à 22 F",  # Should match treatment_planning_2.json
    "26 CC + TR",  # Should partially match "26 dém. CC + dém. tenons + TR 3 canaux + MA + CC"
    "Composite",  # Should match composite sequences
    "Extraction complexe x 2"  # Should match exactly
]

def test_rag_search(query):
    """Test the RAG search endpoint"""
    url = "http://localhost:5010/api/ai/chat"
    
    payload = {
        "message": query,
        "history": [],
        "tab": "dental-brain",
        "settings": {
            "aiModel": "gpt-4o",
            "similarityThreshold": 60,
            "clinicalCasesCount": 2,
            "idealSequencesCount": 5,
            "knowledgeCount": 2
        }
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        print(f"\n🔍 Testing query: '{query}'")
        print("-" * 50)
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check references for similarity scores
            if 'references' in data:
                ideal_sequences = [ref for ref in data['references'] if ref['type'] == 'ideal_sequence']
                
                if ideal_sequences:
                    print(f"Found {len(ideal_sequences)} ideal sequences:")
                    for seq in ideal_sequences[:3]:
                        similarity = seq.get('similarity_score', 0)
                        title = seq.get('title', 'Unknown')
                        consultation = seq.get('enhanced_data', {}).get('consultation_text', '')
                        
                        # Highlight high similarity matches
                        if similarity >= 0.95:
                            print(f"  🎯 [{similarity:.3f}] '{consultation}' - {title}")
                        else:
                            print(f"  ⭐ [{similarity:.3f}] '{consultation}' - {title}")
                else:
                    print("No ideal sequences found")
                    
            else:
                print("No references in response")
                
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Error testing query: {e}")

if __name__ == "__main__":
    print("🧪 Testing RAG Optimization with Consultation-Only Embeddings")
    print("=" * 60)
    
    for query in test_queries:
        test_rag_search(query)
    
    print("\n✅ Test complete!")