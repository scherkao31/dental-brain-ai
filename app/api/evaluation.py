"""
API endpoints for the evaluation system
"""
from flask import Blueprint, request, jsonify, render_template
from flask_login import login_required, current_user
from app import db
from app.models import (EvaluationTestCase, GeneratedSequence, 
                       ManualEvaluation, AutomaticEvaluation)
from app.services import ai_service
from datetime import datetime
import time
import logging

logger = logging.getLogger(__name__)

evaluation_bp = Blueprint('evaluation', __name__)

@evaluation_bp.route('/evaluator')
@login_required
def evaluator_page():
    """Main evaluator page"""
    return render_template('evaluator.html')

@evaluation_bp.route('/test-cases', methods=['GET'])
@login_required
def get_test_cases():
    """Get all test cases"""
    try:
        test_cases = EvaluationTestCase.query.filter_by(is_active=True).all()
        return jsonify({
            'status': 'success',
            'test_cases': [tc.to_dict() for tc in test_cases]
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/test-cases', methods=['POST'])
@login_required
def create_test_case():
    """Create a new test case"""
    try:
        data = request.json
        
        test_case = EvaluationTestCase(
            consultation_text=data['consultation_text'],
            patient_context=data.get('patient_context', {}),
            gold_standard_sequence=data.get('gold_standard_sequence', []),
            difficulty_level=data.get('difficulty_level', 'medium'),
            categories=data.get('categories', []),
            notes=data.get('notes', ''),
            created_by_id=current_user.id
        )
        
        db.session.add(test_case)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'test_case': test_case.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/test-cases/<int:test_case_id>', methods=['PUT'])
@login_required
def update_test_case(test_case_id):
    """Update a test case"""
    try:
        test_case = EvaluationTestCase.query.get_or_404(test_case_id)
        data = request.json
        
        test_case.consultation_text = data.get('consultation_text', test_case.consultation_text)
        test_case.patient_context = data.get('patient_context', test_case.patient_context)
        test_case.gold_standard_sequence = data.get('gold_standard_sequence', test_case.gold_standard_sequence)
        test_case.difficulty_level = data.get('difficulty_level', test_case.difficulty_level)
        test_case.categories = data.get('categories', test_case.categories)
        test_case.notes = data.get('notes', test_case.notes)
        test_case.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'test_case': test_case.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/test-cases/<int:test_case_id>', methods=['DELETE'])
@login_required
def delete_test_case(test_case_id):
    """Delete a test case (soft delete)"""
    try:
        test_case = EvaluationTestCase.query.get_or_404(test_case_id)
        test_case.is_active = False
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Test case deleted'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/generate-sequence', methods=['POST'])
@login_required
def generate_sequence():
    """Generate a sequence for a test case"""
    try:
        data = request.json
        test_case_id = data['test_case_id']
        
        test_case = EvaluationTestCase.query.get_or_404(test_case_id)
        
        # Start timing
        start_time = time.time()
        
        # Generate sequence using AI service
        result = ai_service.process_chat_message(
            test_case.consultation_text,
            'dental-brain',
            {'generateTreatmentPlan': True}
        )
        
        # Calculate generation time
        generation_time_ms = int((time.time() - start_time) * 1000)
        
        # Extract treatment plan and references
        treatment_plan = result.get('treatment_plan', {})
        references = result.get('references', [])
        
        # Save generated sequence
        generated_sequence = GeneratedSequence(
            test_case_id=test_case_id,
            model_version='v1.0',  # TODO: Get from config
            generated_sequence=treatment_plan.get('treatment_sequence', []),
            generation_params={'temperature': 0.7, 'max_tokens': 2000},
            rag_references=references,
            generation_time_ms=generation_time_ms
        )
        
        db.session.add(generated_sequence)
        db.session.commit()
        
        # Optionally run automatic evaluation immediately
        if data.get('auto_evaluate', True):
            # This will be implemented in the evaluation service
            pass
        
        return jsonify({
            'status': 'success',
            'generated_sequence': generated_sequence.to_dict(),
            'treatment_plan': treatment_plan
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error generating sequence: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/sequences/pending', methods=['GET'])
@login_required
def get_pending_sequences():
    """Get sequences pending evaluation"""
    try:
        # Get sequences without manual evaluation
        pending_sequences = db.session.query(GeneratedSequence)\
            .outerjoin(ManualEvaluation)\
            .filter(ManualEvaluation.id == None)\
            .order_by(GeneratedSequence.generated_at.desc())\
            .all()
        
        results = []
        for seq in pending_sequences:
            seq_dict = seq.to_dict()
            seq_dict['test_case'] = seq.test_case.to_dict()
            results.append(seq_dict)
        
        return jsonify({
            'status': 'success',
            'pending_sequences': results
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/sequences/evaluated', methods=['GET'])
@login_required
def get_evaluated_sequences():
    """Get evaluated sequences"""
    try:
        # Get sequences with at least one manual evaluation
        evaluated_sequences = db.session.query(GeneratedSequence)\
            .join(ManualEvaluation)\
            .order_by(GeneratedSequence.generated_at.desc())\
            .all()
        
        results = []
        for seq in evaluated_sequences:
            seq_dict = seq.to_dict()
            seq_dict['test_case'] = seq.test_case.to_dict()
            seq_dict['evaluations'] = [eval.to_dict() for eval in seq.manual_evaluations]
            if seq.automatic_evaluation:
                seq_dict['automatic_evaluation'] = seq.automatic_evaluation.to_dict()
            results.append(seq_dict)
        
        return jsonify({
            'status': 'success',
            'evaluated_sequences': results
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/evaluate/manual', methods=['POST'])
@login_required
def submit_manual_evaluation():
    """Submit a manual evaluation"""
    try:
        data = request.json
        
        evaluation = ManualEvaluation(
            generated_sequence_id=data['generated_sequence_id'],
            evaluator_id=current_user.id,
            clinical_accuracy_score=data['scores']['clinical_accuracy'],
            sequencing_logic_score=data['scores']['sequencing_logic'],
            cost_appropriateness_score=data['scores']['cost_appropriateness'],
            safety_score=data['scores']['safety'],
            completeness_score=data['scores']['completeness'],
            overall_score=data['scores']['overall'],
            strengths=data.get('feedback', {}).get('strengths', ''),
            weaknesses=data.get('feedback', {}).get('weaknesses', ''),
            suggestions=data.get('feedback', {}).get('suggestions', '')
        )
        
        db.session.add(evaluation)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'evaluation': evaluation.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/analytics/overview', methods=['GET'])
@login_required
def get_analytics_overview():
    """Get overview analytics"""
    try:
        # Basic stats
        total_test_cases = EvaluationTestCase.query.filter_by(is_active=True).count()
        total_sequences = GeneratedSequence.query.count()
        total_evaluations = ManualEvaluation.query.count()
        
        # Average scores
        avg_scores = db.session.query(
            db.func.avg(ManualEvaluation.overall_score).label('overall'),
            db.func.avg(ManualEvaluation.clinical_accuracy_score).label('clinical_accuracy'),
            db.func.avg(ManualEvaluation.safety_score).label('safety')
        ).first()
        
        # Recent activity
        recent_evaluations = ManualEvaluation.query\
            .order_by(ManualEvaluation.evaluated_at.desc())\
            .limit(5)\
            .all()
        
        return jsonify({
            'status': 'success',
            'analytics': {
                'total_test_cases': total_test_cases,
                'total_sequences': total_sequences,
                'total_evaluations': total_evaluations,
                'average_scores': {
                    'overall': round(avg_scores.overall or 0, 2),
                    'clinical_accuracy': round(avg_scores.clinical_accuracy or 0, 2),
                    'safety': round(avg_scores.safety or 0, 2)
                },
                'recent_evaluations': [eval.to_dict() for eval in recent_evaluations]
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@evaluation_bp.route('/analytics/performance', methods=['GET'])
@login_required
def get_performance_metrics():
    """Get detailed performance metrics"""
    try:
        # Get date range from query params
        days = request.args.get('days', 30, type=int)
        
        # Query metrics over time
        # This would be more complex in production with proper time series data
        
        return jsonify({
            'status': 'success',
            'performance': {
                'days': days,
                'metrics': []  # TODO: Implement time series metrics
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500