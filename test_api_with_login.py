#!/usr/bin/env python3
"""Test the chat API endpoint with authentication"""

import requests
import json

# Create a session to maintain cookies
session = requests.Session()

# Base URL
base_url = "http://localhost:5010"

# First, login
login_data = {
    "username": "testuser",
    "password": "password"  # Default password used in seed_database.py
}

print("Logging in...")
login_response = session.post(f"{base_url}/auth/login", data=login_data)
print(f"Login status: {login_response.status_code}")

if login_response.status_code != 200:
    print("Login failed!")
    exit(1)

# Now test the chat API
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

headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
}

print("\nTesting chat API with '26 CC'...")
response = session.post(f"{base_url}/api/ai/chat", json=test_data, headers=headers)
print(f"Status Code: {response.status_code}")

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