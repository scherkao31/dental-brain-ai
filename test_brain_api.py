#!/usr/bin/env python3
"""
Test the Brain API endpoint directly
"""

import requests
import json
from app import create_app
from app.models.user import User
from flask_login import login_user

app = create_app()

with app.app_context():
    # Get a user for authentication
    user = User.query.first()
    if user:
        print(f"Found user: {user.username}")
        
        # Create a test client
        client = app.test_client()
        
        # Login the user
        with client:
            with client.session_transaction() as sess:
                sess['_user_id'] = str(user.id)
                sess['_fresh'] = True
            
            # Test the analyze endpoint
            print("\nTesting /api/brain/analyze...")
            response = client.get('/api/brain/analyze')
            
            print(f"Status code: {response.status_code}")
            print(f"Response: {response.get_json()}")
            
            if response.status_code == 200:
                data = response.get_json()
                if data['status'] == 'success':
                    print(f"\n✅ Analysis successful!")
                    print(f"Clinical cases: {data['data']['summary']['total_clinical_cases']}")
                    print(f"Ideal sequences: {data['data']['summary']['total_ideal_sequences']}")
                else:
                    print(f"\n❌ Error: {data.get('message', 'Unknown error')}")
            else:
                print(f"\n❌ HTTP Error: {response.status_code}")
    else:
        print("No users found in database")