from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user
from app import db
from app.models import Conversation, Message
from datetime import datetime
import re
import logging

logger = logging.getLogger(__name__)

ai_bp = Blueprint('ai', __name__)

def generate_smart_title(message):
    """Generate a smart title using GPT-3.5-turbo for better understanding"""
    try:
        from openai import OpenAI
        client = OpenAI()
        
        # Prepare the prompt
        prompt = f"""Tu es un assistant spécialisé en dentisterie. Génère un titre court et descriptif (max 50 caractères) pour cette demande dentaire.

Message: "{message}"

Règles:
- Identifie le traitement principal (facettes, couronnes, implant, etc.)
- Inclus les numéros de dents si mentionnés
- Pour "TT" = "Tout Traitement", "F" = "Facettes", "C" = "Couronne", "CC" = "Couronne Céramique"
- Format idéal: [Traitement] [Dents] ou [Type de question]
- Exemples: "Facettes 12-22", "Implant 36", "Devis couronnes", "Question urgence"

Génère uniquement le titre, rien d'autre."""


        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Tu es un assistant qui génère des titres courts et précis pour des cas dentaires."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=30,
            temperature=0.3
        )
        
        title = response.choices[0].message.content.strip()
        
        # Clean up the title
        title = title.replace('"', '').replace("'", '')
        
        # Ensure it's not too long
        if len(title) > 60:
            title = title[:57] + "..."
            
        return title
        
    except Exception as e:
        logger.error(f"Error generating smart title with LLM: {e}")
        
        # Fallback to simple extraction
        # Look for tooth numbers
        tooth_match = re.search(r'\b(\d{2}(?:\s*[à\-]\s*\d{2})?)\b', message)
        
        # Look for common abbreviations
        if 'TT' in message.upper():
            base = "Traitement complet"
        elif 'F' in message.upper() and tooth_match:
            base = "Facettes"
        elif 'CC' in message.upper():
            base = "Couronne céramique"
        elif 'C' in message.upper() and tooth_match:
            base = "Couronne"
        else:
            # Take first few words
            words = message.split()[:4]
            base = " ".join(words)
        
        if tooth_match and base != " ".join(message.split()[:4]):
            title = f"{base} {tooth_match.group(1)}"
        else:
            title = base
            
            
        if len(title) > 60:
            title = title[:57] + "..."
            
        return title

@ai_bp.route('/chat', methods=['POST'])
@login_required
def chat():
    """Process chat message with AI and save to conversation"""
    from app.services import ai_service
    
    if ai_service is None:
        return jsonify({
            'status': 'error',
            'message': 'AI service not initialized'
        }), 500
    
    try:
        data = request.json
        tab_name = data.get('tab', 'dental-brain')
        message = data.get('message', '')
        conversation_id = data.get('conversation_id')
        user_settings = data.get('settings', {})
        current_treatment_plan = data.get('current_treatment_plan')
        
        if not message:
            return jsonify({
                'status': 'error',
                'message': 'Message requis'
            }), 400
        
        # Get or create conversation
        if conversation_id:
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
        else:
            # Create new conversation with smart title
            smart_title = generate_smart_title(message)
            conversation = Conversation(
                user_id=current_user.id,
                title=smart_title
            )
            db.session.add(conversation)
            db.session.flush()  # Get the ID
        
        # Save user message
        user_message = Message(
            conversation_id=conversation.id,
            role='user',
            content=message
        )
        db.session.add(user_message)
        
        # Get action if provided
        action = data.get('action')
        
        # Process message with AI
        if action == 'generate-protocol':
            # Special handling for protocol generation
            result = ai_service.generate_clinical_protocol(message)
        else:
            result = ai_service.process_chat_message(
                message, 
                tab_name, 
                user_settings, 
                action=action,
                current_treatment_plan=current_treatment_plan
            )
        
        # Prepare metadata
        metadata = {}
        if result.get('references'):
            metadata['references'] = result['references']
        if result.get('is_treatment_plan') and result.get('treatment_plan'):
            metadata['treatment_plan'] = result['treatment_plan']
            metadata['is_treatment_plan'] = True
        
        # Save assistant response
        assistant_message = Message(
            conversation_id=conversation.id,
            role='assistant',
            content=result['response'],
            message_metadata=metadata if metadata else None
        )
        db.session.add(assistant_message)
        
        # Update conversation timestamp and metadata
        conversation.updated_at = datetime.utcnow()
        
        # Update case metadata if treatment plan was generated
        if result.get('is_treatment_plan'):
            conversation.update_case_metadata()
            if not conversation.case_type:
                conversation.case_type = 'treatment_planning'
            
            # Update title to be more descriptive if it's generic
            if len(conversation.title) > 50 or conversation.title.endswith('...') or not any(char.isdigit() for char in conversation.title):
                treatment_plan = result.get('treatment_plan', {})
                if treatment_plan.get('treatment_sequence'):
                    # Extract key procedures from the plan
                    procedures = []
                    teeth_involved = set()
                    
                    for seq in treatment_plan['treatment_sequence'][:3]:  # First 3 appointments
                        treatment = seq.get('traitement', '')
                        if treatment and treatment not in procedures:
                            procedures.append(treatment)
                        
                        teeth = seq.get('dents', [])
                        if teeth:
                            teeth_involved.update(teeth)
                    
                    # Build better title
                    new_title_parts = []
                    
                    if procedures:
                        # Take first procedure or combine if multiple
                        if len(procedures) == 1:
                            new_title_parts.append(procedures[0])
                        else:
                            new_title_parts.append("Plan complexe")
                    
                    if teeth_involved:
                        teeth_list = sorted(list(teeth_involved))[:3]
                        teeth_str = ", ".join(map(str, teeth_list))
                        new_title_parts.append(f"({teeth_str})")
                    
                    if new_title_parts:
                        conversation.title = " ".join(new_title_parts)[:60]
        
        db.session.commit()
        
        response_data = {
            'status': 'success',
            'conversation_id': conversation.id,
            'response': result['response'],
            'references': result.get('references', [])
        }
        
        # Add treatment plan data if available
        if result.get('is_treatment_plan') and result.get('treatment_plan'):
            response_data['treatment_plan'] = result['treatment_plan']
            response_data['is_treatment_plan'] = True
        
        return jsonify(response_data)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@ai_bp.route('/search', methods=['POST'])
def search_knowledge():
    """Search knowledge base"""
    try:
        data = request.json
        query = data.get('query', '')
        search_type = data.get('type', 'combined')  # 'cases', 'knowledge', or 'combined'
        
        if not query:
            return jsonify({
                'status': 'error',
                'message': 'Requête de recherche requise'
            }), 400
        
        # Use RAG service directly for search
        from app.services import rag_service
        
        if search_type == 'cases':
            results = {'cases': rag_service.search_cases(query), 'knowledge': []}
        elif search_type == 'knowledge':
            results = {'cases': [], 'knowledge': rag_service.search_knowledge(query)}
        else:
            results = rag_service.search_combined(query)
        
        return jsonify({
            'status': 'success',
            'results': results
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@ai_bp.route('/reference/<reference_id>', methods=['GET'])
def get_reference_details(reference_id):
    """Get detailed information about a specific reference"""
    from app.services import rag_service
    
    if rag_service is None:
        return jsonify({
            'status': 'error',
            'message': 'RAG service not initialized'
        }), 500
    
    try:
        # Get detailed reference information
        reference_details = rag_service.get_detailed_reference(reference_id)
        
        if reference_details:
            return jsonify({
                'status': 'success',
                'reference': reference_details
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Reference not found'
            }), 404
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500