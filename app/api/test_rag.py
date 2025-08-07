"""Test endpoint for RAG optimization verification"""
from flask import Blueprint, jsonify, request, current_app

test_rag_bp = Blueprint('test_rag', __name__)

@test_rag_bp.route('/api/test/rag-search', methods=['POST'])
def test_rag_search():
    """Test endpoint to verify RAG optimization without authentication"""
    try:
        data = request.get_json()
        query = data.get('query', '')
        
        if not query:
            return jsonify({'status': 'error', 'message': 'Query is required'}), 400
        
        # Get the enhanced RAG service instance from services module
        from app.services import rag_service as enhanced_rag_service
        if not enhanced_rag_service:
            return jsonify({'status': 'error', 'message': 'Enhanced RAG service not available'}), 500
        
        # Search using the enhanced RAG service
        results = enhanced_rag_service.search_enhanced_knowledge(query, n_results=5)
        
        # Format results to show consultation matching
        formatted_results = []
        for result in results:
            formatted_results.append({
                'consultation_text': result.get('consultation_text', ''),
                'consultation_text_expanded': result.get('consultation_text_expanded', ''),
                'similarity_score': result.get('similarity_score', 0),
                'title': result.get('title', ''),
                'type': result.get('type', ''),
                'filename': result.get('filename', '')
            })
        
        # Log high similarity matches
        high_matches = [r for r in formatted_results if r['similarity_score'] >= 0.95]
        if high_matches:
            print(f"\n🎯 High similarity matches for '{query}':")
            for match in high_matches:
                print(f"  - [{match['similarity_score']:.3f}] '{match['consultation_text']}'")
        
        return jsonify({
            'status': 'success',
            'query': query,
            'results': formatted_results,
            'high_matches_count': len(high_matches)
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500