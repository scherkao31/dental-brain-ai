from datetime import datetime
from flask import Blueprint, render_template, jsonify, send_from_directory, redirect, url_for
from flask_login import login_required, current_user
import os

main_bp = Blueprint('main', __name__)

@main_bp.route('/', methods=['GET'])
@login_required
def index():
    """Serve the main chat interface"""
    return render_template('chat.html')


@main_bp.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Dental AI Suite',
        'timestamp': datetime.utcnow().isoformat()
    })

@main_bp.route('/knowledge')
def get_knowledge_stats():
    """Get knowledge base statistics"""
    from app.services import rag_service
    
    if rag_service is None:
        return jsonify({
            'status': 'error',
            'message': 'RAG service not initialized'
        }), 500
    
    stats = rag_service.get_statistics()
    
    return jsonify({
        'status': 'success',
        'statistics': stats
    })

@main_bp.route('/reindex', methods=['POST'])
def reindex_knowledge():
    """Reindex all knowledge"""
    from app.services import rag_service
    
    if rag_service is None:
        return jsonify({
            'status': 'error',
            'message': 'RAG service not initialized'
        }), 500
    
    try:
        result = rag_service.reindex_all()
        
        return jsonify({
            'status': 'success',
            'message': 'Reindexing complete',
            'result': result
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@main_bp.route('/patients')
@login_required
def patients():
    """Serve the patients management page"""
    return render_template('patients.html')

@main_bp.route('/chat')
@login_required
def chat():
    """Serve the chat interface"""
    return render_template('chat.html')

@main_bp.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    static_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'static')
    return send_from_directory(static_folder, filename)