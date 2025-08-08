from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
import logging

logger = logging.getLogger(__name__)

brain_bp = Blueprint('brain', __name__)

@brain_bp.route('/status', methods=['GET'])
@login_required
def get_status():
    """Get brain interface status"""
    from app.services import brain_service
    
    if brain_service is None:
        return jsonify({
            'status': 'error',
            'message': 'Brain service not initialized'
        }), 500
    
    return jsonify(brain_service.get_status())

@brain_bp.route('/start-analysis', methods=['POST'])
@login_required
def start_analysis():
    """Start a new multi-agent analysis"""
    from app.services import brain_service
    
    if brain_service is None:
        return jsonify({
            'status': 'error',
            'message': 'Brain service not initialized'
        }), 500
    
    try:
        result = brain_service.start_analysis()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error starting analysis: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/analysis-progress/<analysis_id>', methods=['GET'])
@login_required
def get_analysis_progress(analysis_id):
    """Get progress of an ongoing analysis"""
    from app.services import brain_service
    
    if brain_service is None:
        return jsonify({
            'status': 'error',
            'message': 'Brain service not initialized'
        }), 500
    
    try:
        result = brain_service.get_analysis_progress(analysis_id)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting analysis progress: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/check-analysis', methods=['GET'])
@login_required
def check_saved_analysis():
    """Check if there are saved analysis results"""
    from app.services import brain_service
    
    if brain_service is None:
        return jsonify({
            'status': 'error',
            'message': 'Brain service not initialized'
        }), 500
    
    try:
        result = brain_service.check_saved_analysis()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error checking saved analysis: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500