#!/usr/bin/env python3
"""Emergency script to add missing columns to production database"""

import os
from app import create_app, db
from sqlalchemy import text

def fix_missing_columns():
    """Add missing columns to conversations table"""
    app = create_app(os.environ.get('FLASK_ENV', 'production'))
    
    with app.app_context():
        try:
            # Check which columns are missing
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'conversations'
            """))
            existing_columns = [row[0] for row in result]
            
            required_columns = [
                ('sequence_rating', 'INTEGER'),
                ('approved_sequence_id', 'VARCHAR(100)'),
                ('case_summary', 'TEXT'),
                ('chief_complaint', 'VARCHAR(500)'),
                ('teeth_involved', 'JSON'),
                ('procedures_discussed', 'JSON'),
                ('status', "VARCHAR(50) DEFAULT 'active'"),
                ('priority', "VARCHAR(20) DEFAULT 'normal'"),
                ('tags', 'JSON DEFAULT \'[]\'::json'),
                ('estimated_cost', 'FLOAT'),
                ('insurance_coverage', 'FLOAT')
            ]
            
            for column_name, column_type in required_columns:
                if column_name not in existing_columns:
                    print(f"Adding missing column: {column_name}")
                    try:
                        db.session.execute(text(f"""
                            ALTER TABLE conversations 
                            ADD COLUMN {column_name} {column_type}
                        """))
                        db.session.commit()
                        print(f"✅ Added column: {column_name}")
                    except Exception as e:
                        print(f"❌ Failed to add column {column_name}: {e}")
                        db.session.rollback()
                else:
                    print(f"✓ Column already exists: {column_name}")
            
            # Also ensure evaluation tables exist
            print("\nEnsuring evaluation tables exist...")
            from app.models import (EvaluationTestCase, GeneratedSequence, 
                                   ManualEvaluation, AutomaticEvaluation, 
                                   EvaluationMetrics)
            db.create_all()
            print("✅ Evaluation tables checked")
            
            print("\n🎉 Database fix completed!")
            
        except Exception as e:
            print(f"❌ Error fixing database: {e}")

if __name__ == '__main__':
    fix_missing_columns()