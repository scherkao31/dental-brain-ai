#!/usr/bin/env python3
"""Quick fix to add missing columns - can be run directly"""

import os
import sys

# Set environment variable if not set
if 'DATABASE_URL' not in os.environ:
    print("ERROR: DATABASE_URL environment variable not set")
    sys.exit(1)

from app import create_app, db
from sqlalchemy import text

app = create_app('production')

with app.app_context():
    print("Adding missing columns to conversations table...")
    
    # List of columns to add
    columns_to_add = [
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sequence_rating INTEGER",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS approved_sequence_id VARCHAR(100)",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS case_summary TEXT",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS chief_complaint VARCHAR(500)",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS teeth_involved JSON DEFAULT '[]'::json",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS procedures_discussed JSON DEFAULT '[]'::json",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal'",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tags JSON DEFAULT '[]'::json",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS estimated_cost FLOAT",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS insurance_coverage FLOAT"
    ]
    
    for sql in columns_to_add:
        try:
            db.session.execute(text(sql))
            db.session.commit()
            print(f"✅ Executed: {sql}")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Failed: {sql} - Error: {e}")
    
    # Also create evaluation tables
    print("\nCreating evaluation tables...")
    try:
        from app.models import (EvaluationTestCase, GeneratedSequence, 
                               ManualEvaluation, AutomaticEvaluation, 
                               EvaluationMetrics)
        db.create_all()
        print("✅ Evaluation tables created")
    except Exception as e:
        print(f"❌ Failed to create evaluation tables: {e}")
    
    print("\n✅ Database fix completed!")