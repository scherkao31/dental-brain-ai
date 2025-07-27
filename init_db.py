#!/usr/bin/env python3
"""Initialize database for production deployment"""

import os
import sys
from app import create_app, db
from app.models import User

def init_database():
    """Initialize the database with required data"""
    # Create app with production config
    app = create_app('production')
    
    with app.app_context():
        # Create all tables
        print("Creating database tables...")
        db.create_all()
        
        # Check if we need to create a default admin user
        if User.query.count() == 0:
            print("Creating default admin user...")
            
            # Use environment variables if available, otherwise use defaults
            admin_username = os.environ.get('ADMIN_USERNAME', 'admin')
            admin_email = os.environ.get('ADMIN_EMAIL', 'admin@dentalbrain.ai')
            admin_password = os.environ.get('ADMIN_PASSWORD', 'changeme123!')
            
            admin = User(
                username=admin_username,
                email=admin_email,
                role='admin'
            )
            admin.set_password(admin_password)
            db.session.add(admin)
            db.session.commit()
            
            print("Default admin user created:")
            print(f"  Username: {admin_username}")
            print(f"  Email: {admin_email}")
            
            # Only show password if using default
            if admin_password == 'changeme123!':
                print("  Password: changeme123!")
                print("  IMPORTANT: Change this password immediately after first login!")
            else:
                print("  Password: [Set via environment variable]")
        else:
            print(f"Database already has {User.query.count()} users.")
        
        print("Database initialization complete!")

if __name__ == '__main__':
    init_database()