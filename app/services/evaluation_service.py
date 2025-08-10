"""
Evaluation service for automatic sequence evaluation
"""
import logging
from typing import Dict, List, Optional, Tuple
import numpy as np
from openai import OpenAI
import json
from app.models import GeneratedSequence, AutomaticEvaluation, EvaluationTestCase
from app import db
from datetime import datetime

logger = logging.getLogger(__name__)


class EvaluationService:
    """Service for evaluating generated treatment sequences"""
    
    def __init__(self):
        self.client = OpenAI()
        self.evaluation_prompts = self._load_evaluation_prompts()
    
    def _load_evaluation_prompts(self) -> Dict[str, str]:
        """Load evaluation prompts for different aspects"""
        return {
            'clinical_accuracy': """En tant qu'expert dentaire, évaluez la précision clinique de cette séquence de traitement.
Considérez:
- L'adéquation des traitements proposés par rapport au diagnostic
- Le respect des protocoles cliniques standards
- La pertinence des choix thérapeutiques

Consultation: {consultation}
Séquence générée: {sequence}
Séquence de référence: {gold_standard}

Donnez une note de 0 à 10 et expliquez votre évaluation.""",

            'sequence_logic': """Évaluez la logique et l'ordre de la séquence de traitement.
Considérez:
- L'ordre logique des interventions
- Les dépendances entre traitements
- L'optimisation du nombre de rendez-vous

Consultation: {consultation}
Séquence générée: {sequence}
Séquence de référence: {gold_standard}

Donnez une note de 0 à 10 et expliquez votre évaluation.""",

            'safety': """Évaluez la sécurité de la séquence pour le patient.
Considérez:
- Les risques potentiels
- Les contre-indications
- Les mesures de précaution nécessaires

Consultation: {consultation}
Contexte patient: {patient_context}
Séquence générée: {sequence}

Donnez une note de 0 à 10. Une séquence dangereuse doit recevoir 0.""",

            'completeness': """Évaluez la complétude de la séquence de traitement.
Considérez:
- Tous les problèmes mentionnés sont-ils traités?
- Y a-t-il des étapes manquantes importantes?
- La séquence couvre-t-elle l'ensemble des besoins?

Consultation: {consultation}
Séquence générée: {sequence}
Séquence de référence: {gold_standard}

Donnez une note de 0 à 10 et identifiez les éléments manquants.""",

            'comparison': """Comparez la séquence générée avec la séquence de référence.
Analysez:
- Les similitudes et différences
- Les avantages et inconvénients de chaque approche
- Laquelle est cliniquement supérieure et pourquoi

Séquence générée: {sequence}
Séquence de référence: {gold_standard}

Fournissez une analyse détaillée et un score de similarité de 0 à 100%."""
        }
    
    async def evaluate_sequence(self, generated_sequence_id: int) -> AutomaticEvaluation:
        """Perform automatic evaluation of a generated sequence"""
        try:
            # Get the generated sequence
            gen_seq = GeneratedSequence.query.get(generated_sequence_id)
            if not gen_seq:
                raise ValueError(f"Generated sequence {generated_sequence_id} not found")
            
            test_case = gen_seq.test_case
            
            # Format sequences for evaluation
            sequence_text = self._format_sequence(gen_seq.generated_sequence)
            gold_standard_text = self._format_sequence(test_case.gold_standard_sequence) if test_case.gold_standard_sequence else "Aucune séquence de référence"
            
            # Perform evaluations
            scores = {}
            feedback = {}
            
            # Clinical accuracy evaluation
            clinical_result = await self._evaluate_aspect(
                'clinical_accuracy',
                consultation=test_case.consultation_text,
                sequence=sequence_text,
                gold_standard=gold_standard_text,
                patient_context=json.dumps(test_case.patient_context or {})
            )
            scores['clinical_accuracy'] = clinical_result['score']
            feedback['clinical_accuracy'] = clinical_result['feedback']
            
            # Sequence logic evaluation
            logic_result = await self._evaluate_aspect(
                'sequence_logic',
                consultation=test_case.consultation_text,
                sequence=sequence_text,
                gold_standard=gold_standard_text
            )
            scores['sequence_logic'] = logic_result['score']
            feedback['sequence_logic'] = logic_result['feedback']
            
            # Safety evaluation
            safety_result = await self._evaluate_aspect(
                'safety',
                consultation=test_case.consultation_text,
                sequence=sequence_text,
                patient_context=json.dumps(test_case.patient_context or {})
            )
            scores['safety'] = safety_result['score']
            feedback['safety'] = safety_result['feedback']
            
            # Completeness evaluation
            completeness_result = await self._evaluate_aspect(
                'completeness',
                consultation=test_case.consultation_text,
                sequence=sequence_text,
                gold_standard=gold_standard_text
            )
            scores['completeness'] = completeness_result['score']
            feedback['completeness'] = completeness_result['feedback']
            
            # Semantic similarity if gold standard exists
            if test_case.gold_standard_sequence:
                comparison_result = await self._evaluate_aspect(
                    'comparison',
                    sequence=sequence_text,
                    gold_standard=gold_standard_text
                )
                scores['semantic_similarity'] = comparison_result['score'] / 100  # Convert to 0-1
                feedback['comparison'] = comparison_result['feedback']
            else:
                scores['semantic_similarity'] = None
            
            # Calculate cost deviation
            cost_deviation = self._calculate_cost_deviation(
                gen_seq.generated_sequence,
                test_case.gold_standard_sequence
            )
            
            # Detect issues
            detected_issues = self._detect_issues(scores, feedback)
            
            # Calculate overall score
            valid_scores = [s for s in scores.values() if s is not None and s > 0]
            overall_score = np.mean(valid_scores) if valid_scores else 0
            
            # Create evaluation record
            evaluation = AutomaticEvaluation(
                generated_sequence_id=generated_sequence_id,
                semantic_similarity_score=scores.get('semantic_similarity'),
                completeness_score=scores['completeness'],
                logic_consistency_score=scores['sequence_logic'],
                cost_deviation_percentage=cost_deviation,
                safety_check_passed=scores['safety'] >= 7,
                overall_score=round(overall_score, 2),
                llm_feedback=feedback,
                detected_issues=detected_issues,
                comparison_details=feedback.get('comparison', {}),
                evaluation_model='gpt-4o-mini'
            )
            
            db.session.add(evaluation)
            db.session.commit()
            
            logger.info(f"Automatic evaluation completed for sequence {generated_sequence_id}")
            return evaluation
            
        except Exception as e:
            logger.error(f"Error in automatic evaluation: {e}")
            db.session.rollback()
            raise
    
    async def _evaluate_aspect(self, aspect: str, **kwargs) -> Dict:
        """Evaluate a specific aspect of the sequence"""
        try:
            prompt = self.evaluation_prompts[aspect].format(**kwargs)
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Vous êtes un expert dentaire évaluant des séquences de traitement. Donnez des évaluations précises et constructives."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            
            # Extract score from response
            score = self._extract_score(content, aspect)
            
            return {
                'score': score,
                'feedback': content
            }
            
        except Exception as e:
            logger.error(f"Error evaluating aspect {aspect}: {e}")
            return {
                'score': 0,
                'feedback': f"Erreur lors de l'évaluation: {str(e)}"
            }
    
    def _format_sequence(self, sequence: List) -> str:
        """Format a sequence for evaluation"""
        if isinstance(sequence, list) and all(isinstance(item, dict) for item in sequence):
            # Format structured sequence
            formatted = []
            for i, step in enumerate(sequence):
                treatment = step.get('traitement', 'N/A')
                teeth = step.get('dents', [])
                duration = step.get('duree', 'N/A')
                formatted.append(f"{i+1}. {treatment} - Dents: {', '.join(map(str, teeth))} - Durée: {duration}")
            return '\n'.join(formatted)
        elif isinstance(sequence, list):
            # Format simple list
            return '\n'.join(f"{i+1}. {step}" for i, step in enumerate(sequence))
        else:
            return str(sequence)
    
    def _extract_score(self, content: str, aspect: str) -> float:
        """Extract numerical score from LLM response"""
        import re
        
        # Look for patterns like "8/10", "8 sur 10", "note: 8", "score: 85%"
        patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:/|sur)\s*10',
            r'(?:note|score)\s*:\s*(\d+(?:\.\d+)?)',
            r'(\d+(?:\.\d+)?)\s*%',
            r'^\s*(\d+(?:\.\d+)?)\s*$'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE | re.MULTILINE)
            if match:
                score = float(match.group(1))
                # Convert percentage to 0-10 scale if needed
                if '%' in pattern and score > 10:
                    score = score / 10
                # Ensure score is within 0-10 range
                return max(0, min(10, score))
        
        # Default scores based on sentiment
        if any(word in content.lower() for word in ['excellent', 'parfait', 'très bien']):
            return 9.0
        elif any(word in content.lower() for word in ['bien', 'bon', 'correct']):
            return 7.0
        elif any(word in content.lower() for word in ['moyen', 'acceptable']):
            return 5.0
        elif any(word in content.lower() for word in ['mauvais', 'incorrect', 'dangereux']):
            return 2.0
        
        return 5.0  # Default middle score
    
    def _calculate_cost_deviation(self, generated_seq: List, gold_standard_seq: List) -> float:
        """Calculate cost deviation percentage between sequences"""
        # This would need actual cost calculation logic
        # For now, return a mock value based on sequence length difference
        if not gold_standard_seq:
            return 0
        
        gen_length = len(generated_seq)
        gold_length = len(gold_standard_seq)
        
        if gold_length == 0:
            return 0
        
        deviation = abs(gen_length - gold_length) / gold_length * 100
        return round(deviation, 2)
    
    def _detect_issues(self, scores: Dict, feedback: Dict) -> List[Dict]:
        """Detect potential issues based on scores and feedback"""
        issues = []
        
        # Check for low scores
        if scores.get('clinical_accuracy', 10) < 6:
            issues.append({
                'type': 'clinical_accuracy',
                'severity': 'high',
                'description': 'Précision clinique insuffisante'
            })
        
        if scores.get('safety', 10) < 7:
            issues.append({
                'type': 'safety',
                'severity': 'critical',
                'description': 'Problèmes de sécurité détectés'
            })
        
        if scores.get('completeness', 10) < 6:
            issues.append({
                'type': 'completeness',
                'severity': 'medium',
                'description': 'Séquence incomplète'
            })
        
        if scores.get('sequence_logic', 10) < 6:
            issues.append({
                'type': 'logic',
                'severity': 'medium',
                'description': 'Ordre des traitements non optimal'
            })
        
        # Check for specific keywords in feedback
        critical_keywords = ['dangereux', 'risque', 'contre-indiqué', 'incorrect']
        for aspect, text in feedback.items():
            if any(keyword in text.lower() for keyword in critical_keywords):
                issues.append({
                    'type': aspect,
                    'severity': 'high',
                    'description': f'Problème identifié dans {aspect}'
                })
        
        return issues
    
    def calculate_metrics(self, start_date: datetime, end_date: datetime, model_version: Optional[str] = None) -> Dict:
        """Calculate evaluation metrics for a time period"""
        try:
            # Query evaluations in the time period
            query = db.session.query(AutomaticEvaluation).join(GeneratedSequence)
            
            if model_version:
                query = query.filter(GeneratedSequence.model_version == model_version)
            
            query = query.filter(
                AutomaticEvaluation.evaluated_at >= start_date,
                AutomaticEvaluation.evaluated_at <= end_date
            )
            
            evaluations = query.all()
            
            if not evaluations:
                return {
                    'period': {'start': start_date, 'end': end_date},
                    'count': 0,
                    'metrics': {}
                }
            
            # Calculate aggregated metrics
            metrics = {
                'count': len(evaluations),
                'average_overall_score': np.mean([e.overall_score for e in evaluations if e.overall_score]),
                'average_clinical_accuracy': np.mean([e.llm_feedback.get('clinical_accuracy_score', 0) for e in evaluations]),
                'average_safety_score': np.mean([1 if e.safety_check_passed else 0 for e in evaluations]) * 10,
                'average_completeness': np.mean([e.completeness_score for e in evaluations if e.completeness_score]),
                'safety_pass_rate': sum(1 for e in evaluations if e.safety_check_passed) / len(evaluations) * 100,
                'issues_by_type': self._aggregate_issues(evaluations),
                'score_distribution': self._calculate_score_distribution(evaluations)
            }
            
            return {
                'period': {'start': start_date, 'end': end_date},
                'model_version': model_version,
                'count': len(evaluations),
                'metrics': metrics
            }
            
        except Exception as e:
            logger.error(f"Error calculating metrics: {e}")
            return {
                'period': {'start': start_date, 'end': end_date},
                'error': str(e)
            }
    
    def _aggregate_issues(self, evaluations: List[AutomaticEvaluation]) -> Dict:
        """Aggregate issues from evaluations"""
        issue_counts = {}
        
        for eval in evaluations:
            if eval.detected_issues:
                for issue in eval.detected_issues:
                    issue_type = issue.get('type', 'unknown')
                    issue_counts[issue_type] = issue_counts.get(issue_type, 0) + 1
        
        return issue_counts
    
    def _calculate_score_distribution(self, evaluations: List[AutomaticEvaluation]) -> Dict:
        """Calculate score distribution"""
        scores = [e.overall_score for e in evaluations if e.overall_score]
        
        distribution = {
            'excellent': sum(1 for s in scores if s >= 9),
            'good': sum(1 for s in scores if 7 <= s < 9),
            'average': sum(1 for s in scores if 5 <= s < 7),
            'poor': sum(1 for s in scores if s < 5)
        }
        
        return distribution