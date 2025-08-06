import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict, Counter
import re
from openai import OpenAI
from app.services.enhanced_rag_service import EnhancedRAGService
from app.services.data_service import DataService
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class BrainService:
    """AI Brain Service - Provides introspection into AI's dental knowledge and reasoning"""
    
    def __init__(self, rag_service: EnhancedRAGService, data_service: DataService):
        self.rag_service = rag_service
        self.data_service = data_service
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self._knowledge_cache = {}
        self._last_analysis = None
        
    def analyze_knowledge_base(self) -> Dict:
        """Comprehensive analysis of the AI's knowledge base"""
        try:
            # Get all data categories
            clinical_cases = self._get_clinical_cases()
            ideal_sequences = self._get_ideal_sequences()
            approved_sequences = self._get_approved_sequences()
            
            # Extract patterns and insights
            patterns = self._extract_treatment_patterns(clinical_cases, ideal_sequences, approved_sequences)
            rules = self._extract_clinical_rules(patterns)
            confidence_map = self._generate_confidence_map(patterns)
            knowledge_gaps = self._identify_knowledge_gaps(patterns)
            
            # Generate timeline of learning
            learning_timeline = self._generate_learning_timeline(approved_sequences)
            
            # Clinical correlations
            correlations = self._extract_clinical_correlations(clinical_cases, approved_sequences)
            
            # Treatment decision trees
            decision_trees = self._build_decision_trees(patterns)
            
            # Convert sets to lists for JSON serialization
            patterns_serializable = self._make_patterns_serializable(patterns)
            
            # Cache the analysis
            self._last_analysis = {
                'timestamp': datetime.now().isoformat(),
                'summary': {
                    'total_clinical_cases': len(clinical_cases),
                    'total_ideal_sequences': len(ideal_sequences),
                    'total_approved_sequences': len(approved_sequences),
                    'high_quality_sequences': sum(1 for s in approved_sequences if s.get('rating', 0) >= 9),
                    'unique_conditions_covered': len(set(self._extract_conditions(clinical_cases + approved_sequences))),
                    'confidence_score': self._calculate_overall_confidence(confidence_map)
                },
                'patterns': patterns_serializable,
                'rules': rules,
                'confidence_map': confidence_map,
                'knowledge_gaps': knowledge_gaps,
                'learning_timeline': learning_timeline,
                'correlations': correlations,
                'decision_trees': decision_trees
            }
            
            return self._last_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing knowledge base: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            error_msg = str(e) if str(e) != "0" else "An error occurred during analysis"
            return {'error': error_msg}
    
    def _extract_treatment_patterns(self, clinical_cases: List, ideal_sequences: List, approved_sequences: List) -> Dict:
        """Extract common treatment patterns from all sources"""
        patterns = {
            'common_sequences': defaultdict(list),
            'treatment_dependencies': defaultdict(set),
            'timing_patterns': defaultdict(list),
            'material_preferences': defaultdict(lambda: defaultdict(int)),
            'contraindications': [],
            'success_factors': defaultdict(list)
        }
        
        # Analyze all sequences
        all_sequences = []
        for case in clinical_cases:
            if 'treatment_sequence' in case:
                all_sequences.append({
                    'source': 'clinical',
                    'sequence': case['treatment_sequence'],
                    'condition': case.get('consultation_text', ''),
                    'rating': None
                })
        
        for seq in ideal_sequences:
            if 'treatment_sequence' in seq:
                all_sequences.append({
                    'source': 'ideal',
                    'sequence': seq['treatment_sequence'],
                    'condition': seq.get('title', ''),
                    'rating': None
                })
        
        for seq in approved_sequences:
            if 'sequence' in seq:
                # Handle both dict and direct list formats
                sequence_data = seq['sequence']
                if isinstance(sequence_data, dict):
                    treatment_seq = sequence_data.get('treatment_sequence', [])
                elif isinstance(sequence_data, list):
                    treatment_seq = sequence_data
                else:
                    treatment_seq = []
                    
                all_sequences.append({
                    'source': 'approved',
                    'sequence': treatment_seq,
                    'condition': seq.get('original_prompt', ''),
                    'rating': seq.get('rating', 0)
                })
        
        # Extract patterns
        for seq_data in all_sequences:
            sequence = seq_data['sequence']
            condition = seq_data['condition'].lower() if seq_data['condition'] else ''
            
            # Common sequences for conditions
            if condition:
                simplified_condition = self._simplify_condition(condition)
                patterns['common_sequences'][simplified_condition].append(sequence)
            
            # Treatment dependencies (what comes before what)
            if isinstance(sequence, list) and len(sequence) > 1:
                for i in range(len(sequence) - 1):
                    if isinstance(sequence[i], dict) and isinstance(sequence[i + 1], dict):
                        current = self._extract_treatment_type(sequence[i].get('traitement', ''))
                        next_treatment = self._extract_treatment_type(sequence[i + 1].get('traitement', ''))
                        if current and next_treatment:
                            patterns['treatment_dependencies'][current].add(next_treatment)
            
            # Timing patterns
            if isinstance(sequence, list):
                for appointment in sequence:
                    if isinstance(appointment, dict) and 'delai' in appointment and appointment['delai']:
                        treatment = self._extract_treatment_type(appointment.get('traitement', ''))
                        if treatment:
                            patterns['timing_patterns'][treatment].append(appointment['delai'])
            
            # Material preferences
            if isinstance(sequence, list):
                for appointment in sequence:
                    if isinstance(appointment, dict):
                        treatment_text = appointment.get('traitement', '').lower()
                        treatment_type = self._extract_treatment_type(treatment_text)
                        material = self._extract_material(treatment_text)
                        if treatment_type and material:
                            patterns['material_preferences'][treatment_type][material] += 1
        
        return patterns
    
    def _extract_clinical_rules(self, patterns: Dict) -> List[Dict]:
        """Extract clinical rules from patterns"""
        rules = []
        
        # Dependency rules
        for treatment, next_treatments in patterns['treatment_dependencies'].items():
            if len(next_treatments) == 1:  # Strong pattern
                rules.append({
                    'type': 'sequence',
                    'rule': f"{treatment} is always followed by {list(next_treatments)[0]}",
                    'confidence': 0.95,
                    'evidence_count': len([1 for seq in patterns['common_sequences'].values() for s in seq])
                })
            elif len(next_treatments) > 1:
                most_common = Counter(next_treatments).most_common(1)[0]
                rules.append({
                    'type': 'sequence',
                    'rule': f"{treatment} is usually followed by {most_common[0]}",
                    'confidence': 0.75,
                    'alternatives': list(next_treatments - {most_common[0]})
                })
        
        # Timing rules
        for treatment, delays in patterns['timing_patterns'].items():
            if delays:
                avg_delay = self._calculate_average_delay(delays)
                rules.append({
                    'type': 'timing',
                    'rule': f"{treatment} typically requires {avg_delay} before next appointment",
                    'confidence': 0.8,
                    'variations': list(set(delays))
                })
        
        # Material preference rules
        for treatment, materials in patterns['material_preferences'].items():
            if materials:
                preferred = max(materials.items(), key=lambda x: x[1])
                total = sum(materials.values())
                confidence = preferred[1] / total
                rules.append({
                    'type': 'material',
                    'rule': f"{treatment} preferably uses {preferred[0]}",
                    'confidence': confidence,
                    'alternatives': {m: c/total for m, c in materials.items() if m != preferred[0]}
                })
        
        return sorted(rules, key=lambda x: x['confidence'], reverse=True)
    
    def _generate_confidence_map(self, patterns: Dict) -> Dict:
        """Generate confidence scores for different treatment scenarios"""
        confidence_map = {
            'by_condition': {},
            'by_treatment_type': {},
            'by_complexity': {},
            'overall_areas': []
        }
        
        # Confidence by condition
        for condition, sequences in patterns['common_sequences'].items():
            if sequences:
                # More examples = higher confidence
                confidence = min(0.95, 0.5 + (len(sequences) * 0.1))
                consistency = self._calculate_sequence_consistency(sequences)
                confidence_map['by_condition'][condition] = {
                    'confidence': confidence,
                    'consistency': consistency,
                    'sample_size': len(sequences)
                }
        
        # Identify high and low confidence areas
        high_confidence = [c for c, data in confidence_map['by_condition'].items() 
                          if data['confidence'] > 0.8]
        low_confidence = [c for c, data in confidence_map['by_condition'].items() 
                         if data['confidence'] < 0.6]
        
        confidence_map['overall_areas'] = [
            {'area': 'High Confidence', 'conditions': high_confidence},
            {'area': 'Low Confidence', 'conditions': low_confidence}
        ]
        
        return confidence_map
    
    def _identify_knowledge_gaps(self, patterns: Dict) -> List[Dict]:
        """Identify areas where AI lacks knowledge or confidence"""
        gaps = []
        
        # Conditions with few examples
        for condition, sequences in patterns['common_sequences'].items():
            if len(sequences) < 3:
                gaps.append({
                    'type': 'insufficient_data',
                    'area': f"Treatment for {condition}",
                    'current_examples': len(sequences),
                    'recommendation': f"Need at least 5 more examples of {condition} treatments"
                })
        
        # Treatments with high variation
        for treatment, delays in patterns['timing_patterns'].items():
            if len(set(delays)) > 5:  # High variation in timing
                gaps.append({
                    'type': 'inconsistent_pattern',
                    'area': f"Timing for {treatment}",
                    'issue': "High variation in recommended delays",
                    'recommendation': "Establish clearer timing guidelines"
                })
        
        # Missing common dental procedures
        common_procedures = ['implant', 'extraction', 'root canal', 'crown', 'bridge', 'denture']
        covered_procedures = set()
        for sequences in patterns['common_sequences'].values():
            for seq in sequences:
                if isinstance(seq, list):
                    for appt in seq:
                        if isinstance(appt, dict):
                            treatment = self._extract_treatment_type(appt.get('traitement', ''))
                            if treatment:
                                covered_procedures.add(treatment.lower())
        
        for proc in common_procedures:
            if proc not in covered_procedures:
                gaps.append({
                    'type': 'missing_procedure',
                    'area': proc.capitalize(),
                    'issue': "No examples in knowledge base",
                    'recommendation': f"Add clinical cases involving {proc}"
                })
        
        return gaps
    
    def explore_knowledge(self, query: str, exploration_type: str = 'general') -> Dict:
        """Conversational exploration of AI's knowledge"""
        try:
            if exploration_type == 'general':
                return self._general_exploration(query)
            elif exploration_type == 'clinical':
                return self._clinical_exploration(query)
            elif exploration_type == 'confidence':
                return self._confidence_exploration(query)
            elif exploration_type == 'learning':
                return self._learning_exploration(query)
            else:
                return {'error': 'Unknown exploration type'}
                
        except Exception as e:
            logger.error(f"Error in knowledge exploration: {str(e)}")
            return {'error': str(e)}
    
    def _general_exploration(self, query: str) -> Dict:
        """General exploration of AI knowledge"""
        # Get latest analysis
        if not self._last_analysis:
            self.analyze_knowledge_base()
        
        # Create a prompt that explores the knowledge base
        prompt = f"""
        Based on our dental knowledge base analysis, answer this question: {query}
        
        Knowledge base summary:
        - {self._last_analysis['summary']['total_clinical_cases']} clinical cases
        - {self._last_analysis['summary']['total_approved_sequences']} approved sequences
        - {self._last_analysis['summary']['unique_conditions_covered']} unique conditions covered
        
        Key patterns identified:
        {json.dumps(self._last_analysis['rules'][:5], indent=2)}
        
        Provide a detailed, insightful answer that demonstrates deep understanding of our knowledge base.
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an AI that introspects on dental knowledge patterns."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        return {
            'response': response.choices[0].message.content,
            'context': {
                'knowledge_base_size': self._last_analysis['summary'],
                'related_patterns': self._find_related_patterns(query)
            }
        }
    
    def _clinical_exploration(self, query: str) -> Dict:
        """Explore clinical decision-making process"""
        # Search for relevant clinical cases
        relevant_cases = self.rag_service.search_enhanced_knowledge(query, n_results=5)
        
        prompt = f"""
        Explain the clinical decision-making process for: {query}
        
        Based on these relevant cases:
        {self._format_cases_for_prompt(relevant_cases[:3])}
        
        Break down:
        1. Key decision points
        2. Factors to consider
        3. Common approaches
        4. Potential complications
        5. Success indicators
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a dental AI explaining clinical reasoning."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=1200
        )
        
        return {
            'response': response.choices[0].message.content,
            'supporting_cases': [
                {
                    'title': case['title'],
                    'similarity': case['similarity_score'],
                    'type': case['type']
                } for case in relevant_cases[:3]
            ]
        }
    
    def get_learning_insights(self) -> Dict:
        """Get insights about AI's learning progression"""
        approved_sequences = self._get_approved_sequences()
        
        if not approved_sequences:
            return {'status': 'no_data', 'message': 'No approved sequences yet'}
        
        # Sort by date
        approved_sequences.sort(key=lambda x: x.get('approved_date', ''))
        
        # Analyze progression
        insights = {
            'total_sequences': len(approved_sequences),
            'average_rating': sum(s.get('rating', 0) for s in approved_sequences) / len(approved_sequences),
            'quality_trend': self._calculate_quality_trend(approved_sequences),
            'complexity_progression': self._analyze_complexity_progression(approved_sequences),
            'common_improvements': self._identify_common_improvements(approved_sequences)
        }
        
        return insights
    
    def generate_clinical_dashboard(self) -> Dict:
        """Generate data for clinical dashboard visualization"""
        if not self._last_analysis:
            self.analyze_knowledge_base()
        
        dashboard_data = {
            'knowledge_overview': {
                'total_knowledge_items': sum([
                    self._last_analysis['summary']['total_clinical_cases'],
                    self._last_analysis['summary']['total_ideal_sequences'],
                    self._last_analysis['summary']['total_approved_sequences']
                ]),
                'high_quality_percentage': (
                    self._last_analysis['summary']['high_quality_sequences'] / 
                    max(1, self._last_analysis['summary']['total_approved_sequences']) * 100
                ),
                'coverage_score': self._calculate_coverage_score()
            },
            'top_patterns': self._get_top_patterns(),
            'confidence_heatmap': self._generate_confidence_heatmap(),
            'decision_trees': self._simplify_decision_trees(),
            'knowledge_gaps': self._last_analysis['knowledge_gaps'][:5],
            'recent_learnings': self._get_recent_learnings()
        }
        
        return dashboard_data
    
    # Helper methods
    def _get_clinical_cases(self) -> List[Dict]:
        """Get all clinical cases from data service"""
        try:
            items = self.data_service.get_items_by_category('clinical_cases')
            full_cases = []
            for item in items:
                # Get full data for each item
                full_data = self.data_service.get_item('clinical_cases', item['id'])
                if full_data:
                    full_cases.append(full_data)
            return full_cases
        except Exception as e:
            logger.error(f"Error getting clinical cases: {e}")
            return []
    
    def _get_ideal_sequences(self) -> List[Dict]:
        """Get all ideal sequences from data service"""
        try:
            items = self.data_service.get_items_by_category('ideal_sequences')
            full_sequences = []
            for item in items:
                # Get full data for each item
                full_data = self.data_service.get_item('ideal_sequences', item['id'])
                if full_data:
                    full_sequences.append(full_data)
            return full_sequences
        except Exception as e:
            logger.error(f"Error getting ideal sequences: {e}")
            return []
    
    def _get_approved_sequences(self) -> List[Dict]:
        """Get all approved sequences from data service"""
        try:
            items = self.data_service.get_items_by_category('approved_sequences')
            full_sequences = []
            for item in items:
                # Get full data for each item
                full_data = self.data_service.get_item('approved_sequences', item['id'])
                if full_data:
                    full_sequences.append(full_data)
            return full_sequences
        except Exception as e:
            logger.error(f"Error getting approved sequences: {e}")
            return []
    
    def _simplify_condition(self, condition: str) -> str:
        """Simplify condition text for pattern matching"""
        # Extract key treatment indicators
        patterns = [
            (r'\d+\s*à\s*\d+\s*[A-Z]', 'multiple_teeth_treatment'),
            (r'facette|fac\.', 'facette'),
            (r'couronne|CC', 'couronne'),
            (r'implant', 'implant'),
            (r'TR|traitement.*racine', 'root_canal'),
            (r'composite|cpr', 'composite'),
            (r'extraction|ext\.', 'extraction')
        ]
        
        for pattern, label in patterns:
            if re.search(pattern, condition, re.IGNORECASE):
                return label
        
        return 'other'
    
    def _extract_treatment_type(self, treatment_text: str) -> Optional[str]:
        """Extract standardized treatment type from text"""
        treatment_map = {
            'facette': ['facette', 'fac.', 'F'],
            'couronne': ['couronne', 'CC', 'crown'],
            'composite': ['composite', 'cpr', 'comp'],
            'root_canal': ['TR', 'traitement racine', 'endo'],
            'implant': ['implant', 'impl'],
            'extraction': ['extraction', 'ext.', 'avulsion']
        }
        
        treatment_lower = treatment_text.lower()
        for standard_name, variations in treatment_map.items():
            if any(var.lower() in treatment_lower for var in variations):
                return standard_name
        
        return None
    
    def _extract_material(self, treatment_text: str) -> Optional[str]:
        """Extract material from treatment text"""
        materials = {
            'ceramic': ['céramique', 'ceramic', 'porcelain'],
            'composite': ['composite', 'comp'],
            'zirconia': ['zircone', 'zirconia'],
            'metal': ['métal', 'metal', 'chrome'],
            'gold': ['or', 'gold']
        }
        
        treatment_lower = treatment_text.lower()
        for material, variations in materials.items():
            if any(var in treatment_lower for var in variations):
                return material
        
        return None
    
    def _make_patterns_serializable(self, patterns: Dict) -> Dict:
        """Convert sets in patterns to lists for JSON serialization"""
        serializable = {}
        for key, value in patterns.items():
            if key == 'treatment_dependencies':
                serializable[key] = {
                    treatment: list(dependencies) 
                    for treatment, dependencies in value.items()
                }
            else:
                serializable[key] = value
        return serializable
    
    def _extract_conditions(self, data_list: List[Dict]) -> List[str]:
        """Extract unique conditions from data"""
        conditions = set()
        for item in data_list:
            if 'consultation_text' in item:
                conditions.add(self._simplify_condition(item['consultation_text']))
            elif 'original_prompt' in item:
                conditions.add(self._simplify_condition(item['original_prompt']))
        return list(conditions)
    
    def _calculate_overall_confidence(self, confidence_map: Dict) -> float:
        """Calculate overall confidence score"""
        if not confidence_map.get('by_condition'):
            return 0.0
        
        confidences = [data['confidence'] for data in confidence_map['by_condition'].values()]
        return sum(confidences) / len(confidences) if confidences else 0.0
    
    def _calculate_sequence_consistency(self, sequences: List) -> float:
        """Calculate how consistent sequences are for a condition"""
        if len(sequences) < 2:
            return 1.0
        
        # Compare sequence lengths
        lengths = [len(seq) for seq in sequences]
        avg_length = sum(lengths) / len(lengths)
        length_variance = sum((l - avg_length) ** 2 for l in lengths) / len(lengths)
        
        # Lower variance = higher consistency
        consistency = max(0, 1 - (length_variance / avg_length if avg_length > 0 else 0))
        return consistency
    
    def _calculate_average_delay(self, delays: List[str]) -> str:
        """Calculate average delay from list of delay strings"""
        # Simple implementation - could be enhanced
        if not delays:
            return "variable"
        
        # Count most common delay
        delay_counter = Counter(delays)
        most_common = delay_counter.most_common(1)[0][0]
        return most_common
    
    def _generate_learning_timeline(self, approved_sequences: List[Dict]) -> List[Dict]:
        """Generate timeline of AI learning milestones"""
        timeline = []
        
        # Sort by date
        sorted_sequences = sorted(
            approved_sequences, 
            key=lambda x: x.get('approved_date', ''),
            reverse=False
        )
        
        # Identify milestones
        if sorted_sequences:
            # First approved sequence
            timeline.append({
                'date': sorted_sequences[0].get('approved_date', ''),
                'milestone': 'First Approved Sequence',
                'details': f"Rating: {sorted_sequences[0].get('rating', 'N/A')}/10"
            })
            
            # First high-quality sequence
            for seq in sorted_sequences:
                if seq.get('rating', 0) >= 9:
                    timeline.append({
                        'date': seq.get('approved_date', ''),
                        'milestone': 'First High-Quality Sequence',
                        'details': f"Achieved 9+/10 rating"
                    })
                    break
            
            # Complexity milestones
            complex_conditions = ['implant', 'multiple_teeth', 'full_mouth']
            for condition in complex_conditions:
                for seq in sorted_sequences:
                    if condition in seq.get('original_prompt', '').lower():
                        timeline.append({
                            'date': seq.get('approved_date', ''),
                            'milestone': f'First {condition.title()} Case',
                            'details': f"Expanded to complex {condition} treatments"
                        })
                        break
        
        return sorted(timeline, key=lambda x: x['date'])
    
    def _extract_clinical_correlations(self, clinical_cases: List, approved_sequences: List) -> Dict:
        """Extract correlations between conditions and treatments"""
        correlations = {
            'condition_treatment': defaultdict(lambda: defaultdict(int)),
            'treatment_success': defaultdict(list),
            'material_condition': defaultdict(lambda: defaultdict(int))
        }
        
        # Analyze all sequences
        all_data = clinical_cases + [s for s in approved_sequences if 'sequence' in s]
        
        for data in all_data:
            condition = self._simplify_condition(
                data.get('consultation_text', data.get('original_prompt', ''))
            )
            
            # Handle different data structures
            sequence = data.get('treatment_sequence', [])
            if not sequence and 'sequence' in data:
                seq_data = data['sequence']
                if isinstance(seq_data, dict):
                    sequence = seq_data.get('treatment_sequence', [])
                elif isinstance(seq_data, list):
                    sequence = seq_data
            rating = data.get('rating', 8)  # Default rating for clinical cases
            
            if isinstance(sequence, list):
                for appointment in sequence:
                    if isinstance(appointment, dict):
                        treatment = self._extract_treatment_type(appointment.get('traitement', ''))
                        if treatment:
                            correlations['condition_treatment'][condition][treatment] += 1
                            correlations['treatment_success'][treatment].append(rating)
                            
                            material = self._extract_material(appointment.get('traitement', ''))
                            if material:
                                correlations['material_condition'][condition][material] += 1
        
        return correlations
    
    def _build_decision_trees(self, patterns: Dict) -> Dict:
        """Build simplified decision trees for common scenarios"""
        decision_trees = {}
        
        # Build tree for each common condition
        for condition, sequences in patterns['common_sequences'].items():
            if len(sequences) >= 3:  # Need enough data
                tree = {
                    'condition': condition,
                    'decision_points': [],
                    'common_paths': []
                }
                
                # Identify decision points
                first_treatments = []
                for seq in sequences:
                    if isinstance(seq, list) and len(seq) > 0 and isinstance(seq[0], dict):
                        first_treatments.append(seq[0].get('traitement', ''))
                
                if len(set(first_treatments)) > 1:
                    tree['decision_points'].append({
                        'question': 'Initial treatment approach?',
                        'options': list(set(first_treatments)),
                        'factors': self._identify_decision_factors(condition)
                    })
                
                # Common treatment paths
                for seq in sequences[:3]:  # Top 3 examples
                    path = []
                    if isinstance(seq, list):
                        for appt in seq:
                            if isinstance(appt, dict):
                                treatment_type = self._extract_treatment_type(appt.get('traitement', ''))
                                if treatment_type:
                                    path.append(treatment_type)
                    if path:
                        tree['common_paths'].append(path)
                
                decision_trees[condition] = tree
        
        return decision_trees
    
    def _identify_decision_factors(self, condition: str) -> List[str]:
        """Identify factors that influence treatment decisions"""
        # This could be enhanced with ML analysis
        common_factors = {
            'facette': ['Patient smoker status', 'Budget constraints', 'Aesthetic expectations'],
            'couronne': ['Remaining tooth structure', 'Occlusion', 'Material preference'],
            'implant': ['Bone density', 'Patient age', 'Healing capacity'],
            'root_canal': ['Number of canals', 'Infection severity', 'Previous treatments']
        }
        
        return common_factors.get(condition, ['Patient preference', 'Clinical presentation', 'Cost considerations'])
    
    def _format_cases_for_prompt(self, cases: List[Dict]) -> str:
        """Format cases for LLM prompt"""
        formatted = []
        for case in cases:
            formatted.append(f"- {case['title']} (Type: {case['type']}, Score: {case['similarity_score']:.2f})")
        return '\n'.join(formatted)
    
    def _calculate_quality_trend(self, sequences: List[Dict]) -> str:
        """Calculate quality trend over time"""
        if len(sequences) < 3:
            return "insufficient_data"
        
        # Get last 10 sequences
        recent = sequences[-10:]
        older = sequences[-20:-10] if len(sequences) > 10 else sequences[:len(sequences)//2]
        
        recent_avg = sum(s.get('rating', 0) for s in recent) / len(recent)
        older_avg = sum(s.get('rating', 0) for s in older) / len(older) if older else recent_avg
        
        if recent_avg > older_avg + 0.5:
            return "improving"
        elif recent_avg < older_avg - 0.5:
            return "declining"
        else:
            return "stable"
    
    def _analyze_complexity_progression(self, sequences: List[Dict]) -> Dict:
        """Analyze how complexity of cases has progressed"""
        complexity_over_time = []
        
        for seq in sequences:
            sequence_data = seq.get('sequence', {}).get('treatment_sequence', [])
            complexity_score = len(sequence_data)  # Simple metric: number of appointments
            
            complexity_over_time.append({
                'date': seq.get('approved_date', ''),
                'complexity': complexity_score,
                'rating': seq.get('rating', 0)
            })
        
        return {
            'progression': complexity_over_time,
            'trend': 'increasing' if complexity_over_time and 
                    complexity_over_time[-1]['complexity'] > complexity_over_time[0]['complexity'] 
                    else 'stable'
        }
    
    def _identify_common_improvements(self, sequences: List[Dict]) -> List[str]:
        """Identify common improvements in approved sequences"""
        improvements = []
        
        # Analyze high-rated sequences
        high_rated = [s for s in sequences if s.get('rating', 0) >= 9]
        
        if high_rated:
            # Common patterns in high-rated sequences
            common_elements = []
            for seq in high_rated:
                # Handle different sequence structures
                sequence_data = seq.get('sequence', [])
                if isinstance(sequence_data, dict):
                    sequence_data = sequence_data.get('treatment_sequence', [])
                
                if isinstance(sequence_data, list):
                    for appt in sequence_data:
                        if isinstance(appt, dict):
                            if 'delai' in appt and appt['delai']:
                                common_elements.append('proper_timing')
                            if 'remarque' in appt and appt['remarque']:
                                common_elements.append('detailed_notes')
            
            element_counts = Counter(common_elements)
            for element, count in element_counts.most_common(3):
                if count > len(high_rated) / 2:
                    improvements.append(f"Consistent {element.replace('_', ' ')}")
        
        return improvements
    
    def _calculate_coverage_score(self) -> float:
        """Calculate how well the knowledge base covers dental procedures"""
        common_procedures = [
            'facette', 'couronne', 'implant', 'root_canal', 'composite',
            'extraction', 'bridge', 'orthodontics', 'cleaning', 'surgery'
        ]
        
        covered = 0
        if self._last_analysis and 'patterns' in self._last_analysis:
            for proc in common_procedures:
                if proc in str(self._last_analysis['patterns']).lower():
                    covered += 1
        
        return (covered / len(common_procedures)) * 100
    
    def _get_top_patterns(self) -> List[Dict]:
        """Get top clinical patterns"""
        if not self._last_analysis or 'rules' not in self._last_analysis:
            return []
        
        return self._last_analysis['rules'][:10]
    
    def _generate_confidence_heatmap(self) -> Dict:
        """Generate data for confidence heatmap visualization"""
        if not self._last_analysis or 'confidence_map' not in self._last_analysis:
            return {}
        
        heatmap_data = []
        for condition, data in self._last_analysis['confidence_map']['by_condition'].items():
            heatmap_data.append({
                'condition': condition,
                'confidence': data['confidence'],
                'samples': data['sample_size']
            })
        
        return {
            'data': sorted(heatmap_data, key=lambda x: x['confidence'], reverse=True),
            'scale': {
                'low': 0.0,
                'medium': 0.6,
                'high': 0.8,
                'very_high': 0.9
            }
        }
    
    def _simplify_decision_trees(self) -> List[Dict]:
        """Simplify decision trees for visualization"""
        if not self._last_analysis or 'decision_trees' not in self._last_analysis:
            return []
        
        simplified = []
        for condition, tree in self._last_analysis['decision_trees'].items():
            if tree['common_paths']:
                simplified.append({
                    'condition': condition,
                    'paths': tree['common_paths'][:3],  # Top 3 paths
                    'decision_count': len(tree['decision_points'])
                })
        
        return simplified[:5]  # Top 5 conditions
    
    def _get_recent_learnings(self) -> List[Dict]:
        """Get recent learning insights"""
        approved_sequences = self._get_approved_sequences()
        
        if not approved_sequences:
            return []
        
        # Get sequences from last 30 days
        recent_date = datetime.now() - timedelta(days=30)
        recent_sequences = []
        
        for seq in approved_sequences:
            try:
                approved_date = datetime.fromisoformat(seq.get('approved_date', '').replace('Z', '+00:00'))
                if approved_date.replace(tzinfo=None) > recent_date:
                    recent_sequences.append(seq)
            except:
                continue
        
        learnings = []
        if recent_sequences:
            # New conditions learned
            new_conditions = set()
            for seq in recent_sequences:
                condition = self._simplify_condition(seq.get('original_prompt', ''))
                new_conditions.add(condition)
            
            if new_conditions:
                learnings.append({
                    'type': 'new_conditions',
                    'description': f"Learned {len(new_conditions)} new treatment patterns",
                    'details': list(new_conditions)[:3]
                })
            
            # Quality improvements
            avg_rating = sum(s.get('rating', 0) for s in recent_sequences) / len(recent_sequences)
            if avg_rating >= 8.5:
                learnings.append({
                    'type': 'quality',
                    'description': f"Maintaining high quality with {avg_rating:.1f}/10 average",
                    'details': f"{len([s for s in recent_sequences if s.get('rating', 0) >= 9])} sequences rated 9+/10"
                })
        
        return learnings
    
    def _analyze_response_confidence(self, ai_response: Dict) -> Dict:
        """Analyze confidence in AI's response"""
        confidence_factors = {
            'has_treatment_plan': ai_response.get('is_treatment_plan', False),
            'references_count': len(ai_response.get('references', [])),
            'high_similarity_refs': 0,
            'average_similarity': 0.0
        }
        
        # Analyze reference quality
        references = ai_response.get('references', [])
        if references:
            similarities = [ref.get('similarity_score', 0) for ref in references if 'similarity_score' in ref]
            if similarities:
                confidence_factors['average_similarity'] = sum(similarities) / len(similarities)
                confidence_factors['high_similarity_refs'] = sum(1 for s in similarities if s >= 0.8)
        
        # Calculate overall confidence
        confidence_score = 0.5  # Base confidence
        if confidence_factors['has_treatment_plan']:
            confidence_score += 0.2
        if confidence_factors['references_count'] >= 3:
            confidence_score += 0.1
        if confidence_factors['high_similarity_refs'] >= 1:
            confidence_score += 0.2
        
        confidence_factors['overall_confidence'] = min(1.0, confidence_score)
        
        return confidence_factors
    
    def _find_related_patterns(self, query: str) -> List[Dict]:
        """Find patterns related to the query"""
        if not self._last_analysis or 'patterns' not in self._last_analysis:
            return []
        
        related = []
        query_lower = query.lower()
        
        # Search through rules
        for rule in self._last_analysis.get('rules', []):
            if query_lower in rule.get('rule', '').lower():
                related.append({
                    'type': 'rule',
                    'content': rule['rule'],
                    'confidence': rule.get('confidence', 0)
                })
        
        # Search through patterns
        for condition, sequences in self._last_analysis['patterns']['common_sequences'].items():
            if query_lower in condition.lower() and sequences:
                related.append({
                    'type': 'pattern',
                    'content': f"{len(sequences)} examples of {condition} treatments",
                    'confidence': 0.8
                })
        
        return related[:5]
    
    def _confidence_exploration(self, query: str) -> Dict:
        """Explore AI's confidence in specific areas"""
        # Get confidence data
        if not self._last_analysis:
            self.analyze_knowledge_base()
        
        confidence_data = self._last_analysis.get('confidence_map', {})
        
        prompt = f"""
        Analyze confidence levels for: {query}
        
        Current confidence map shows:
        {json.dumps(confidence_data.get('overall_areas', []), indent=2)}
        
        Explain:
        1. Current confidence level for this query
        2. Why confidence is at this level
        3. What data would improve confidence
        4. Similar areas with higher/lower confidence
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are analyzing AI confidence in dental procedures."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=800
        )
        
        return {
            'response': response.choices[0].message.content,
            'confidence_data': confidence_data
        }
    
    def _learning_exploration(self, query: str) -> Dict:
        """Explore what the AI has learned recently"""
        insights = self.get_learning_insights()
        
        prompt = f"""
        Based on learning insights, answer: {query}
        
        Recent learning data:
        - Total sequences learned: {insights.get('total_sequences', 0)}
        - Average quality: {insights.get('average_rating', 0):.1f}/10
        - Quality trend: {insights.get('quality_trend', 'unknown')}
        
        Common improvements identified:
        {json.dumps(insights.get('common_improvements', []), indent=2)}
        
        Provide insights about the learning process and knowledge evolution.
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are analyzing AI learning progression in dentistry."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=800
        )
        
        return {
            'response': response.choices[0].message.content,
            'learning_metrics': insights
        }