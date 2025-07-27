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
            admin = User(
                username='admin',
                email='admin@dentalbrain.ai',
                role='admin'
            )
            admin.set_password('changeme123!')  # IMPORTANT: Change this password immediately!
            db.session.add(admin)
            db.session.commit()
            print("Default admin user created:")
            print("  Username: admin")
            print("  Password: changeme123!")
            print("  IMPORTANT: Change this password immediately after first login!")
        else:
            print(f"Database already has {User.query.count()} users.")
        
        print("Database initialization complete!")

if __name__ == '__main__':
    init_database()