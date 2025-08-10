"""
Add evaluation tables migration
"""
from app import create_app, db
from app.models import (EvaluationTestCase, GeneratedSequence, 
                       ManualEvaluation, AutomaticEvaluation, EvaluationMetrics)

def run_migration():
    """Create evaluation tables"""
    app = create_app()
    
    with app.app_context():
        # Create all tables
        db.create_all()
        
        print("✅ Evaluation tables created successfully:")
        print("  - evaluation_test_cases")
        print("  - generated_sequences")
        print("  - manual_evaluations")
        print("  - automatic_evaluations")
        print("  - evaluation_metrics")

if __name__ == '__main__':
    run_migration()