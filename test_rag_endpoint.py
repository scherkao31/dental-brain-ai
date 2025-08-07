#!/usr/bin/env python3
"""Test the RAG search endpoint"""

import requests
import json

# API endpoint (no authentication required)
url = "http://localhost:5010/api/test/rag-search"

# Test data
test_data = {
    "query": "26 CC"
}

headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
}

print("Testing RAG search with '26 CC'...")
print(f"URL: {url}")

try:
    response = requests.post(url, json=test_data, headers=headers)
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("\nResponse:")
        print(json.dumps(result, indent=2))
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Exception: {e}")