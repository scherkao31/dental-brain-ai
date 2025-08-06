from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
import logging

logger = logging.getLogger(__name__)

brain_bp = Blueprint('brain', __name__)

@brain_bp.route('/analyze', methods=['GET'])
@login_required
def analyze_knowledge():
    """Analyze the entire knowledge base"""
    from app.services import brain_service
    
    try:
        if brain_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Brain service not initialized'
            }), 500
        
        # Perform comprehensive analysis
        analysis = brain_service.analyze_knowledge_base()
        
        if 'error' in analysis:
            return jsonify({
                'status': 'error',
                'message': analysis['error']
            }), 500
        
        return jsonify({
            'status': 'success',
            'data': analysis
        })
        
    except Exception as e:
        logger.error(f"Error analyzing knowledge base: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/explore', methods=['POST'])
@login_required
def explore_knowledge():
    """Conversational exploration of AI knowledge"""
    from app.services import brain_service
    
    try:
        if brain_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Brain service not initialized'
            }), 500
        
        data = request.json
        query = data.get('query', '')
        exploration_type = data.get('type', 'general')
        
        if not query:
            return jsonify({
                'status': 'error',
                'message': 'Query is required'
            }), 400
        
        # Explore knowledge
        result = brain_service.explore_knowledge(query, exploration_type)
        
        if 'error' in result:
            return jsonify({
                'status': 'error',
                'message': result['error']
            }), 500
        
        return jsonify({
            'status': 'success',
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Error exploring knowledge: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/insights', methods=['GET'])
@login_required
def get_learning_insights():
    """Get learning insights and progression"""
    from app.services import brain_service
    
    try:
        if brain_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Brain service not initialized'
            }), 500
        
        insights = brain_service.get_learning_insights()
        
        return jsonify({
            'status': 'success',
            'data': insights
        })
        
    except Exception as e:
        logger.error(f"Error getting learning insights: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/dashboard', methods=['GET'])
@login_required
def get_clinical_dashboard():
    """Get data for clinical dashboard visualization"""
    from app.services import brain_service
    
    try:
        if brain_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Brain service not initialized'
            }), 500
        
        dashboard_data = brain_service.generate_clinical_dashboard()
        
        return jsonify({
            'status': 'success',
            'data': dashboard_data
        })
        
    except Exception as e:
        logger.error(f"Error generating dashboard: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/patterns/<pattern_type>', methods=['GET'])
@login_required
def get_specific_patterns(pattern_type):
    """Get specific pattern types from analysis"""
    from app.services import brain_service
    
    try:
        if brain_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Brain service not initialized'
            }), 500
        
        # Get or generate analysis
        if not brain_service._last_analysis:
            brain_service.analyze_knowledge_base()
        
        # Valid pattern types
        valid_types = ['rules', 'confidence_map', 'knowledge_gaps', 'decision_trees', 
                      'correlations', 'learning_timeline']
        
        if pattern_type not in valid_types:
            return jsonify({
                'status': 'error',
                'message': f'Invalid pattern type. Valid types: {", ".join(valid_types)}'
            }), 400
        
        pattern_data = brain_service._last_analysis.get(pattern_type, {})
        
        return jsonify({
            'status': 'success',
            'data': pattern_data
        })
        
    except Exception as e:
        logger.error(f"Error getting patterns: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/test-scenario', methods=['POST'])
@login_required
def test_clinical_scenario():
    """Test AI understanding with a clinical scenario"""
    from app.services import brain_service, ai_service
    
    try:
        if brain_service is None or ai_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Services not initialized'
            }), 500
        
        data = request.json
        scenario = data.get('scenario', '')
        
        if not scenario:
            return jsonify({
                'status': 'error',
                'message': 'Scenario is required'
            }), 400
        
        # Get AI response for the scenario
        ai_response = ai_service.process_chat_message(
            scenario, 
            'dental-brain',
            settings={
                'clinicalCasesCount': 3,
                'idealSequencesCount': 2,
                'knowledgeCount': 2,
                'similarityThreshold': 60,
                'ragPreference': 0,
                'showSimilarityScores': True,
                'explainReasoning': True,
                'reasoningMode': 'adaptive'
            }
        )
        
        # Analyze the response
        analysis = {
            'scenario': scenario,
            'ai_response': ai_response.get('response', ''),
            'is_treatment_plan': ai_response.get('is_treatment_plan', False),
            'treatment_plan': ai_response.get('treatment_plan', None),
            'references_used': ai_response.get('references', []),
            'confidence_analysis': brain_service._analyze_response_confidence(ai_response)
        }
        
        return jsonify({
            'status': 'success',
            'data': analysis
        })
        
    except Exception as e:
        logger.error(f"Error testing scenario: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/knowledge-graph', methods=['GET'])
@login_required
def get_knowledge_graph():
    """Get knowledge graph data for visualization"""
    from app.services import brain_service
    
    try:
        if brain_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Brain service not initialized'
            }), 500
        
        # Build knowledge graph
        if not brain_service._last_analysis:
            brain_service.analyze_knowledge_base()
        
        # Extract nodes and edges from analysis
        nodes = []
        edges = []
        
        # Add condition nodes
        for condition in brain_service._last_analysis['patterns']['common_sequences'].keys():
            nodes.append({
                'id': f'condition_{condition}',
                'label': condition.replace('_', ' ').title(),
                'type': 'condition',
                'size': len(brain_service._last_analysis['patterns']['common_sequences'][condition])
            })
        
        # Add treatment nodes and edges from dependencies
        for treatment, next_treatments in brain_service._last_analysis['patterns']['treatment_dependencies'].items():
            if treatment:
                nodes.append({
                    'id': f'treatment_{treatment}',
                    'label': treatment.replace('_', ' ').title(),
                    'type': 'treatment'
                })
                
                for next_treatment in next_treatments:
                    edges.append({
                        'source': f'treatment_{treatment}',
                        'target': f'treatment_{next_treatment}',
                        'type': 'sequence'
                    })
        
        # Add material nodes
        for treatment, materials in brain_service._last_analysis['patterns']['material_preferences'].items():
            for material, count in materials.items():
                material_id = f'material_{material}'
                if not any(n['id'] == material_id for n in nodes):
                    nodes.append({
                        'id': material_id,
                        'label': material.title(),
                        'type': 'material'
                    })
                
                edges.append({
                    'source': f'treatment_{treatment}',
                    'target': material_id,
                    'type': 'uses',
                    'weight': count
                })
        
        return jsonify({
            'status': 'success',
            'data': {
                'nodes': nodes,
                'edges': edges
            }
        })
        
    except Exception as e:
        logger.error(f"Error generating knowledge graph: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@brain_bp.route('/validate-understanding', methods=['POST'])
@login_required
def validate_understanding():
    """Allow dentists to validate AI's understanding"""
    from app.services import brain_service
    
    try:
        if brain_service is None:
            return jsonify({
                'status': 'error',
                'message': 'Brain service not initialized'
            }), 500
        
        data = request.json
        understanding_item = data.get('item', {})
        validation = data.get('validation', {})
        
        # Store validation feedback
        # This could be enhanced to store in a database
        logger.info(f"Validation received from {current_user.username}: {validation}")
        
        return jsonify({
            'status': 'success',
            'message': 'Validation recorded'
        })
        
    except Exception as e:
        logger.error(f"Error recording validation: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500