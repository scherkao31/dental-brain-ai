from flask import Blueprint, request, jsonify
from flask_login import login_required
import os
import json
import logging

logger = logging.getLogger(__name__)

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

@data_bp.route('/approved-sequence', methods=['POST'])
@login_required
def save_approved_sequence():
    """Save an approved treatment sequence"""
    from app.services import data_service
    from flask_login import current_user
    from datetime import datetime
    
    try:
        if data_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Data service not initialized'
            }), 500
            
        data = request.json
        
        # Extract and validate data
        sequence = data.get('sequence')
        rating = data.get('rating')
        original_prompt = data.get('original_prompt', '')
        
        if not sequence or rating is None:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: sequence and rating'
            }), 400
            
        # Validate rating
        if not isinstance(rating, (int, float)) or rating < 1 or rating > 10:
            return jsonify({
                'status': 'error',
                'message': 'Rating must be between 1 and 10'
            }), 400
        
        # Prepare the data to save
        approved_data = {
            'original_prompt': original_prompt,
            'sequence': sequence,
            'rating': rating,
            'approved_by': current_user.username if hasattr(current_user, 'username') else 'User',
            'approved_date': datetime.now().isoformat(),
            'created_at': datetime.now().isoformat(),
            'keywords': data.get('keywords', []),
            'use_in_rag': rating >= 9  # Only use sequences rated 9/10+ in RAG
        }
        
        # Save to approved_sequences category
        item_id = data_service.create_item('approved_sequences', approved_data)
        
        if item_id:
            # Update the conversation if conversation_id is provided
            conversation_id = data.get('conversation_id')
            if conversation_id:
                try:
                    from app.models.user import Conversation
                    from app import db
                    
                    conversation = Conversation.query.get(conversation_id)
                    if conversation:
                        conversation.treatment_plan_approved = True
                        conversation.sequence_rating = rating
                        conversation.approved_sequence_id = item_id
                        conversation.approval_date = datetime.now()
                        conversation.approved_by = current_user.username if hasattr(current_user, 'username') else 'User'
                        db.session.commit()
                        logger.info(f"Updated conversation {conversation_id} with approval info")
                except Exception as e:
                    logger.error(f"Error updating conversation: {e}")
            
            # Update knowledge base and trigger reindexing for RAG if this is a high-quality sequence
            if rating >= 9:
                try:
                    # Update the comprehensive knowledge base
                    import subprocess
                    result = subprocess.run(
                        ['python3', 'update_knowledge_base_with_approved.py'],
                        capture_output=True,
                        text=True,
                        cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                    )
                    
                    if result.returncode == 0:
                        logger.info("Updated knowledge base with approved sequence")
                        
                        # Trigger reindexing
                        from app.services import rag_service
                        if rag_service:
                            rag_service.reindex_all()
                            logger.info("Triggered RAG reindexing")
                    else:
                        logger.error(f"Failed to update knowledge base: {result.stderr}")
                except Exception as e:
                    logger.error(f"Error updating knowledge base: {e}")
            
            return jsonify({
                'status': 'success',
                'item_id': item_id,
                'message': f'Séquence approuvée avec succès (Note: {rating}/10)'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to save approved sequence'
            }), 400
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500