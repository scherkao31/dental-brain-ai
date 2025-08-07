#!/usr/bin/env python3
"""Test the chat API endpoint directly"""

import requests
import json

# API endpoint
url = "http://localhost:5010/api/ai/chat"

# Test message
test_data = {
    "message": "26 CC",
    "history": [],
    "tab": "dental-brain",
    "settings": {
        "similarityThreshold": 60,
        "clinicalCasesCount": 3,
        "idealSequencesCount": 2,
        "knowledgeCount": 2,
        "showSimilarityScores": True,
        "ragPreference": 0,
        "aiModel": "gpt-4o"
    }
}

# Headers
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
}

print("Testing chat API with '26 CC'...")
print(f"URL: {url}")
print(f"Data: {json.dumps(test_data, indent=2)}")

try:
    response = requests.post(url, json=test_data, headers=headers)
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("\nResponse:")
        print(f"Status: {result.get('status')}")
        print(f"References count: {len(result.get('references', []))}")
        
        if result.get('references'):
            print("\nReferences found:")
            for ref in result['references']:
                print(f"  - Type: {ref['type']}")
                print(f"    Title: {ref['title']}")
                if 'similarity_score' in ref:
                    print(f"    Score: {ref['similarity_score']:.3f}")
        else:
            print("\nNo references found!")
            
        # Check response text
        print(f"\nResponse preview: {result.get('response', '')[:200]}...")
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Exception: {e}")