from flask import Blueprint, request, jsonify
from flask_login import login_required
import os
import json

data_bp = Blueprint('data', __name__)

@data_bp.route('/test', methods=['GET'])
def test_data_service():
    """Test endpoint to verify data service availability"""
    from app.services import data_service
    
    return jsonify({
        'status': 'success',
        'data_service_available': data_service is not None,
        'message': 'Data service is available' if data_service else 'Data service not initialized'
    })

@data_bp.route('/categories', methods=['GET'])
@login_required
def get_categories():
    """Get all data categories"""
    from app.services import data_service
    
    try:
        if data_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Data service not initialized'
            }), 500
            
        categories = data_service.get_categories()
        return jsonify({
            'status': 'success',
            'categories': categories
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@data_bp.route('/items/<category>', methods=['GET'])
@login_required
def get_category_items(category):
    """Get all items in a category"""
    from app.services import data_service
    
    try:
        if data_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Data service not initialized'
            }), 500
            
        items = data_service.get_items_by_category(category)
        return jsonify({
            'status': 'success',
            'items': items
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@data_bp.route('/item/<category>/<item_id>', methods=['GET'])
@login_required
def get_item(category, item_id):
    """Get a specific item"""
    from app.services import data_service
    
    try:
        if data_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Data service not initialized'
            }), 500
            
        item = data_service.get_item(category, item_id)
        if item:
            return jsonify({
                'status': 'success',
                'item': item
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Item not found'
            }), 404
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@data_bp.route('/item/<category>/<item_id>', methods=['PUT'])
@login_required
def update_item(category, item_id):
    """Update an existing item"""
    from app.services import data_service
    
    try:
        if data_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Data service not initialized'
            }), 500
            
        data = request.json
        success = data_service.update_item(category, item_id, data)
        
        if success:
            # Trigger reindexing for RAG
            from app.services import rag_service
            if rag_service:
                rag_service.reindex_all()
            
            return jsonify({
                'status': 'success',
                'message': 'Item updated successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to update item'
            }), 400
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@data_bp.route('/item/<category>', methods=['POST'])
@login_required
def create_item(category):
    """Create a new item"""
    from app.services import data_service
    
    try:
        if data_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Data service not initialized'
            }), 500
            
        data = request.json
        item_id = data_service.create_item(category, data)
        
        if item_id:
            # Trigger reindexing for RAG
            from app.services import rag_service
            if rag_service:
                rag_service.reindex_all()
            
            return jsonify({
                'status': 'success',
                'item_id': item_id,
                'message': 'Item created successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to create item'
            }), 400
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@data_bp.route('/item/<category>/<item_id>', methods=['DELETE'])
@login_required
def delete_item(category, item_id):
    """Delete an item"""
    from app.services import data_service
    
    try:
        if data_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Data service not initialized'
            }), 500
            
        success = data_service.delete_item(category, item_id)
        
        if success:
            # Trigger reindexing for RAG
            from app.services import rag_service
            if rag_service:
                rag_service.reindex_all()
            
            return jsonify({
                'status': 'success',
                'message': 'Item deleted successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to delete item'
            }), 400
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@data_bp.route('/search', methods=['GET'])
@login_required
def search_items():
    """Search across all data"""
    from app.services import data_service
    
    try:
        if data_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Data service not initialized'
            }), 500
            
        query = request.args.get('q', '')
        category = request.args.get('category', None)
        
        results = data_service.search_items(query, category)
        
        return jsonify({
            'status': 'success',
            'results': results
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500