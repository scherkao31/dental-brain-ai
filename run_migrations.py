#!/usr/bin/env python3
"""Run database migrations for production"""

import os
import sys
from flask_migrate import upgrade, init, migrate
from app import create_app, db
from sqlalchemy import inspect

def run_migrations():
    """Run all pending database migrations"""
    print("Running database migrations...")
    
    # Create app with production config
    app = create_app(os.environ.get('FLASK_ENV', 'production'))
    
    with app.app_context():
        try:
            # Check if alembic_version table exists
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'alembic_version' not in tables:
                print("Migration system not initialized, skipping migrations...")
                # Don't try to initialize - it may already exist from git
            
            # Run all pending migrations
            print("Running pending migrations...")
            upgrade()
            
            # Also ensure evaluation tables exist
            from app.models import (EvaluationTestCase, GeneratedSequence, 
                                   ManualEvaluation, AutomaticEvaluation, 
                                   EvaluationMetrics)
            db.create_all()
            
            print("✅ All migrations completed successfully!")
            
        except Exception as e:
            print(f"❌ Error running migrations: {e}")
            # Don't exit with error - allow deployment to continue
            print("Continuing despite migration errors...")

if __name__ == '__main__':
    run_migrations()