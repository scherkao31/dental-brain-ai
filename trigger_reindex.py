#!/usr/bin/env python3
"""Trigger reindexing of the RAG knowledge base to fix approved sequence titles"""

import requests
import json

def trigger_reindex():
    """Trigger the reindex endpoint"""
    url = "http://localhost:5010/reindex"
    
    try:
        print("Triggering knowledge base reindexing...")
        response = requests.post(url)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Reindexing successful!")
            print(f"Response: {json.dumps(result, indent=2)}")
        else:
            print(f"❌ Reindexing failed with status code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the server. Make sure the app is running on http://localhost:5001")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    trigger_reindex()