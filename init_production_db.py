#!/usr/bin/env python3
"""Initialize database for production deployment with conflict resolution"""

import os
import sys
from app import create_app, db
from sqlalchemy import text
from app.models import User

def init_database():
    """Initialize the database with required data"""
    # Create app with production config
    app = create_app('production')
    
    with app.app_context():
        try:
            # Check if there are any existing tables with conflicts
            inspector = db.inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            if existing_tables:
                print(f"Found existing tables: {existing_tables}")
                
                # Check for schema conflicts by trying to query
                try:
                    # Try to query the users table
                    user_count = User.query.count()
                    print(f"Database appears healthy with {user_count} existing users")
                except Exception as e:
                    print(f"Database schema conflict detected: {e}")
                    print("Dropping all tables and recreating...")
                    
                    # Drop all tables
                    db.session.execute(text('DROP SCHEMA public CASCADE'))
                    db.session.execute(text('CREATE SCHEMA public'))
                    db.session.commit()
                    
                    # Recreate tables
                    db.create_all()
                    print("Database tables recreated successfully")
            else:
                print("No existing tables found, creating new database schema...")
                db.create_all()
                print("Database tables created successfully")
            
            # Now check if we need to create admin user
            if User.query.count() == 0:
                print("Creating default admin user...")
                
                # Use environment variables if available
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
                
                if admin_password == 'changeme123!':
                    print("  Password: changeme123!")
                    print("  IMPORTANT: Change this password immediately!")
                else:
                    print("  Password: [Set via environment variable]")
            else:
                print(f"Database already has {User.query.count()} users")
            
            print("Database initialization complete!")
            
        except Exception as e:
            print(f"Error during database initialization: {e}")
            sys.exit(1)

if __name__ == '__main__':
    init_database()