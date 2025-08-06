from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import User, Conversation, Message

user_bp = Blueprint('user', __name__)

@user_bp.route('/profile', methods=['GET'])
@login_required
def get_profile():
    """Get current user's profile"""
    return jsonify({
        'status': 'success',
        'user': current_user.to_dict()
    })

@user_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update current user's profile"""
    try:
        data = request.json
        
        # Update allowed fields
        if 'full_name' in data:
            current_user.full_name = data['full_name'].strip()
        
        if 'theme' in data and data['theme'] in ['light', 'dark']:
            current_user.theme = data['theme']
        
        if 'email' in data:
            new_email = data['email'].lower().strip()
            if new_email != current_user.email:
                # Check if email is already taken
                if User.query.filter_by(email=new_email).first():
                    return jsonify({
                        'status': 'error',
                        'message': 'Cet email est déjà utilisé'
                    }), 409
                current_user.email = new_email
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'user': current_user.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/password', methods=['PUT'])
@login_required
def change_password():
    """Change user's password"""
    try:
        data = request.json
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({
                'status': 'error',
                'message': 'Mot de passe actuel et nouveau requis'
            }), 400
        
        if not current_user.check_password(current_password):
            return jsonify({
                'status': 'error',
                'message': 'Mot de passe actuel incorrect'
            }), 401
        
        if len(new_password) < 6:
            return jsonify({
                'status': 'error',
                'message': 'Le nouveau mot de passe doit contenir au moins 6 caractères'
            }), 400
        
        current_user.set_password(new_password)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Mot de passe modifié avec succès'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/conversations', methods=['GET'])
@login_required
def get_conversations():
    """Get user's conversation history"""
    try:
        conversations = current_user.conversations.filter_by(is_active=True)\
            .order_by(Conversation.updated_at.desc())\
            .limit(50)\
            .all()
        
        return jsonify({
            'status': 'success',
            'conversations': [conv.to_dict(summary=True) for conv in conversations]
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/conversations/<int:conversation_id>', methods=['GET'])
@login_required
def get_conversation(conversation_id):
    """Get a specific conversation with messages"""
    try:
        conversation = Conversation.query.filter_by(
            id=conversation_id,
            user_id=current_user.id,
            is_active=True
        ).first()
        
        if not conversation:
            return jsonify({
                'status': 'error',
                'message': 'Conversation non trouvée'
            }), 404
        
        messages = conversation.messages.order_by(Message.created_at).all()
        
        return jsonify({
            'status': 'success',
            'conversation': conversation.to_dict(),
            'messages': [msg.to_dict() for msg in messages]
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/conversations/<int:conversation_id>', methods=['DELETE'])
@login_required
def delete_conversation(conversation_id):
    """Delete a conversation"""
    try:
        conversation = Conversation.query.filter_by(
            id=conversation_id,
            user_id=current_user.id
        ).first()
        
        if not conversation:
            return jsonify({
                'status': 'error',
                'message': 'Conversation non trouvée'
            }), 404
        
        # Soft delete
        conversation.is_active = False
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Conversation supprimée'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/conversations/<int:conversation_id>/title', methods=['PUT'])
@login_required
def update_conversation_title(conversation_id):
    """Update conversation title"""
    try:
        conversation = Conversation.query.filter_by(
            id=conversation_id,
            user_id=current_user.id
        ).first()
        
        if not conversation:
            return jsonify({
                'status': 'error',
                'message': 'Conversation non trouvée'
            }), 404
        
        data = request.json
        new_title = data.get('title', '').strip()
        
        if not new_title:
            return jsonify({
                'status': 'error',
                'message': 'Titre requis'
            }), 400
        
        conversation.title = new_title
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'conversation': conversation.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/settings', methods=['GET'])
@login_required
def get_settings():
    """Get user's settings"""
    try:
        settings = current_user.settings or {}
        
        # Merge with defaults to ensure all keys exist
        default_settings = {
            'ragPreference': 0,
            'similarityThreshold': 60,
            'clinicalCasesCount': 3,
            'idealSequencesCount': 2,
            'knowledgeCount': 2,
            'reasoningMode': 'adaptive',
            'aiModel': 'gpt-4o',
            'showSimilarityScores': True,
            'explainReasoning': True,
            'autoExpandTreatment': True,
            'compactView': False
        }
        
        # Merge user settings with defaults
        merged_settings = {**default_settings, **settings}
        
        return jsonify({
            'status': 'success',
            'settings': merged_settings
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/settings', methods=['POST'])
@login_required
def update_settings():
    """Update user's settings"""
    try:
        data = request.json
        
        # Validate settings
        allowed_keys = {
            'ragPreference', 'similarityThreshold', 'clinicalCasesCount',
            'idealSequencesCount', 'knowledgeCount', 'reasoningMode',
            'aiModel', 'showSimilarityScores', 'explainReasoning', 
            'autoExpandTreatment', 'compactView'
        }
        
        # Filter only allowed keys
        filtered_settings = {k: v for k, v in data.items() if k in allowed_keys}
        
        # Validate ranges
        if 'ragPreference' in filtered_settings:
            filtered_settings['ragPreference'] = max(-100, min(100, filtered_settings['ragPreference']))
        
        if 'similarityThreshold' in filtered_settings:
            filtered_settings['similarityThreshold'] = max(0, min(100, filtered_settings['similarityThreshold']))
        
        if 'clinicalCasesCount' in filtered_settings:
            filtered_settings['clinicalCasesCount'] = max(1, min(10, filtered_settings['clinicalCasesCount']))
        
        if 'idealSequencesCount' in filtered_settings:
            filtered_settings['idealSequencesCount'] = max(1, min(10, filtered_settings['idealSequencesCount']))
        
        if 'knowledgeCount' in filtered_settings:
            filtered_settings['knowledgeCount'] = max(1, min(10, filtered_settings['knowledgeCount']))
        
        if 'reasoningMode' in filtered_settings:
            if filtered_settings['reasoningMode'] not in ['strict', 'adaptive', 'creative']:
                filtered_settings['reasoningMode'] = 'adaptive'
        
        if 'aiModel' in filtered_settings:
            if filtered_settings['aiModel'] not in ['gpt-4o', 'o4-mini']:
                filtered_settings['aiModel'] = 'gpt-4o'
        
        # Update user settings
        current_settings = current_user.settings or {}
        current_settings.update(filtered_settings)
        current_user.settings = current_settings
        
        # Mark the settings field as modified for SQLAlchemy to detect changes
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(current_user, 'settings')
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'settings': current_user.settings
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/conversations/<int:conversation_id>/approve', methods=['POST'])
@login_required
def approve_treatment_plan(conversation_id):
    """Approve a treatment plan in a conversation"""
    try:
        from datetime import datetime
        
        conversation = Conversation.query.filter_by(
            id=conversation_id,
            user_id=current_user.id
        ).first()
        
        if not conversation:
            return jsonify({
                'status': 'error',
                'message': 'Conversation non trouvée'
            }), 404
        
        if not conversation.has_treatment_plan:
            return jsonify({
                'status': 'error',
                'message': 'Aucun plan de traitement à approuver'
            }), 400
        
        data = request.json
        approved_by = data.get('approved_by', current_user.full_name or current_user.username)
        
        conversation.treatment_plan_approved = True
        conversation.approval_date = datetime.utcnow()
        conversation.approved_by = approved_by
        conversation.status = 'completed'
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'conversation': conversation.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/conversations/<int:conversation_id>/status', methods=['PUT'])
@login_required
def update_conversation_status(conversation_id):
    """Update conversation status and metadata"""
    try:
        from datetime import datetime
        
        conversation = Conversation.query.filter_by(
            id=conversation_id,
            user_id=current_user.id
        ).first()
        
        if not conversation:
            return jsonify({
                'status': 'error',
                'message': 'Conversation non trouvée'
            }), 404
        
        data = request.json
        
        # Update allowed fields
        if 'status' in data:
            conversation.status = data['status']
        if 'priority' in data:
            conversation.priority = data['priority']
        if 'case_type' in data:
            conversation.case_type = data['case_type']
        if 'tags' in data:
            conversation.tags = data['tags']
        if 'case_summary' in data:
            conversation.case_summary = data['case_summary']
        if 'chief_complaint' in data:
            conversation.chief_complaint = data['chief_complaint']
        
        conversation.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'conversation': conversation.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
