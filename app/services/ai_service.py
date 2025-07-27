import os
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from openai import OpenAI
from app.services.enhanced_rag_service import EnhancedRAGService
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class SpecializedLLM:
    """Specialized LLM instance for each tab with focused context and prompts"""
    
    def __init__(self, tab_name: str, system_prompt: str, rag_service: EnhancedRAGService):
        self.tab_name = tab_name
        self.base_system_prompt = system_prompt
        self.rag_service = rag_service
        self.chat_history = []
        
    def get_specialized_context(self, user_message: str, settings: Dict) -> Tuple[Dict, str]:
        """Get context specifically relevant to dental brain using enhanced RAG"""
        # Use settings to determine result counts
        case_results = settings.get('clinicalCasesCount', 3)
        ideal_results = settings.get('idealSequencesCount', 2)
        knowledge_results = settings.get('knowledgeCount', 2)
        
        # Use enhanced search with multiple sources for dental-brain
        rag_results = self.rag_service.search_combined_with_sources(
            user_message, 
            case_results=case_results,
            ideal_results=ideal_results,
            knowledge_results=knowledge_results
        )
        
        # Apply similarity threshold
        similarity_threshold = settings.get('similarityThreshold', 60) / 100.0
        rag_preference = settings.get('ragPreference', 0)
        
        # Filter results based on similarity threshold
        filtered_results = {
            'clinical_cases': [
                case for case in rag_results.get('clinical_cases', [])
                if case['similarity_score'] >= similarity_threshold
            ],
            'ideal_sequences': [
                seq for seq in rag_results.get('ideal_sequences', [])
                if seq['similarity_score'] >= similarity_threshold
            ],
            'general_knowledge': [
                knowledge for knowledge in rag_results.get('general_knowledge', [])
                if knowledge['similarity_score'] >= similarity_threshold
            ]
        }
        
        # Apply RAG preference weighting
        # -100 = strong preference for clinical cases
        # 0 = balanced
        # 100 = strong preference for ideal sequences
        
        # Format context based on enhanced results
        context_parts = []
        
        # Order based on preference
        if rag_preference < -20:  # Prefer clinical cases
            context_order = ['clinical_cases', 'ideal_sequences', 'general_knowledge']
        elif rag_preference > 20:  # Prefer ideal sequences
            context_order = ['ideal_sequences', 'clinical_cases', 'general_knowledge']
        else:  # Balanced
            context_order = ['clinical_cases', 'ideal_sequences', 'general_knowledge']
        
        # Build context in preferred order
        for source_type in context_order:
            if source_type == 'clinical_cases' and filtered_results.get('clinical_cases'):
                context_parts.append("=== CAS CLINIQUES PERTINENTS ===")
                
                # Apply preference boost for clinical cases when preferred
                for case in filtered_results['clinical_cases']:
                    similarity_pct = int(case['similarity_score'] * 100)
                    
                    # Boost importance if clinical cases are preferred
                    if rag_preference < -50 and similarity_pct >= 70:
                        similarity_pct = min(100, similarity_pct + 10)
                    
                    # Highlight high similarity cases
                    if similarity_pct >= 90:
                        context_parts.append(f"\n🎯 CORRESPONDANCE EXACTE [{similarity_pct}%] - UTILISER CETTE SÉQUENCE EXACTEMENT 🎯")
                        context_parts.append(f"[{similarity_pct}% similaire] {case['title']}:")
                    elif similarity_pct >= 80:
                        context_parts.append(f"\n⚠️ HAUTE SIMILARITÉ [{similarity_pct}%] - SUIVRE CE CAS PRÉCISÉMENT ⚠️")
                        context_parts.append(f"[{similarity_pct}% similaire] {case['title']}:")
                    else:
                        context_parts.append(f"\n[{similarity_pct}% similaire] {case['title']}:")
                        
                    context_parts.append(f"Consultation: {case['enhanced_data'].get('consultation_text', '')}")
                    if case['enhanced_data'].get('consultation_text_expanded'):
                        context_parts.append(f"Consultation étendue: {case['enhanced_data']['consultation_text_expanded']}")
                        
                    # Add treatment sequence for high similarity cases
                    if similarity_pct >= 80 and case['enhanced_data'].get('treatment_sequence'):
                        context_parts.append("SÉQUENCE À REPRODUIRE:")
                        for appt in case['enhanced_data']['treatment_sequence']:
                            context_parts.append(f"  RDV {appt['rdv']}: {appt['traitement']} ({appt.get('duree', 'N/A')})")
            
            elif source_type == 'ideal_sequences' and filtered_results.get('ideal_sequences'):
                context_parts.append("\n=== SÉQUENCES IDÉALES ===")
                
                # Check if we already have a high similarity clinical case
                has_high_similarity_case = any(
                    int(case['similarity_score'] * 100) >= 80 
                    for case in filtered_results.get('clinical_cases', [])
                )
                
                for sequence in filtered_results['ideal_sequences']:
                    similarity_pct = int(sequence['similarity_score'] * 100)
                    
                    # Boost importance if ideal sequences are preferred
                    if rag_preference > 50 and similarity_pct >= 70:
                        similarity_pct = min(100, similarity_pct + 10)
                    
                    # Highlight high similarity ideal sequences
                    if similarity_pct >= 80 and not has_high_similarity_case:
                        context_parts.append(f"\n⚠️ SÉQUENCE IDÉALE PERTINENTE [{similarity_pct}%] ⚠️")
                        context_parts.append(f"[{similarity_pct}% similaire] {sequence['title']}:")
                    else:
                        context_parts.append(f"\n[{similarity_pct}% similaire] {sequence['title']} (séquence générique):")
                        
                    context_parts.append(f"Source: {sequence['source']}")
                    
                    # Add full treatment sequence for high similarity ideal sequences
                    if sequence['enhanced_data'].get('treatment_sequence_enhanced'):
                        if similarity_pct >= 80:
                            context_parts.append("SÉQUENCE COMPLÈTE À SUIVRE:")
                            for appointment in sequence['enhanced_data']['treatment_sequence_enhanced']:
                                context_parts.append(f"  RDV {appointment['rdv']}: {appointment.get('traitement_expanded', appointment.get('traitement', ''))} ({appointment.get('duree', 'N/A')})")
                                if appointment.get('delai'):
                                    context_parts.append(f"    Délai: {appointment['delai']}")
                        else:
                            context_parts.append("Séquences de traitement recommandées:")
                            for appointment in sequence['enhanced_data']['treatment_sequence_enhanced'][:5]:  # Limit to first 5
                                if appointment.get('traitement_expanded'):
                                    context_parts.append(f"  - {appointment['traitement_expanded']} ({appointment.get('duree', 'N/A')})")
            
            elif source_type == 'general_knowledge' and filtered_results.get('general_knowledge'):
                context_parts.append("\n=== CONNAISSANCES PERTINENTES ===")
                for knowledge in filtered_results['general_knowledge']:
                    similarity_pct = int(knowledge['similarity_score'] * 100)
                    context_parts.append(f"\n[{similarity_pct}% similaire] {knowledge['title']}:")
                    context_parts.append(f"Type: {knowledge['type']}")
                    if knowledge['categories']:
                        context_parts.append(f"Catégories: {', '.join(knowledge['categories'])}")
        
        # Update reasoning mode in context
        reasoning_mode = settings.get('reasoningMode', 'adaptive')
        if reasoning_mode == 'strict':
            context_parts.insert(0, "🔒 MODE STRICT: Suivre exactement les cas similaires sans adaptation.")
        elif reasoning_mode == 'creative':
            context_parts.insert(0, "🎨 MODE CRÉATIF: Utiliser les références comme inspiration avec liberté d'adaptation.")
        
        context = "\n".join(context_parts) if context_parts else ""
        
        # Return both filtered results (for references) and original results (for similarity info)
        return {'filtered': filtered_results, 'original': rag_results}, context
    
    def format_prompt(self, user_message: str, context: str) -> str:
        """Format the complete prompt with context"""
        prompt_parts = [self.base_system_prompt]
        
        if context:
            prompt_parts.append(f"\n\n--- CONTEXTE SPÉCIFIQUE ---\n{context}")
        
        # Add recent chat history for context
        if self.chat_history:
            prompt_parts.append("\n\n--- HISTORIQUE RÉCENT ---")
            for h in self.chat_history[-3:]:  # Last 3 exchanges
                prompt_parts.append(f"User: {h['user']}")
                prompt_parts.append(f"Assistant: {h['assistant']}")
        
        return "\n".join(prompt_parts)

class AIService:
    """Service for managing AI/LLM operations"""
    
    def __init__(self, rag_service: EnhancedRAGService):
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.rag_service = rag_service
        self.specialized_llms = self._initialize_specialized_llms()
    
    def _initialize_specialized_llms(self) -> Dict[str, SpecializedLLM]:
        """Initialize specialized LLM for dental brain"""
        prompt = """Vous êtes un assistant dentaire IA spécialisé dans la planification de traitements.
                             
                             Votre rôle principal est de générer des séquences de traitement détaillées basées sur les cas cliniques existants et les séquences idéales.
                             
                             RÈGLES DE PRIORITÉ CRITIQUES:
                             
                             1. CAS CLINIQUES EXACTS (≥ 90% similarité): Reproduire EXACTEMENT la séquence du cas clinique
                             2. CAS CLINIQUES TRÈS SIMILAIRES (≥ 80% similarité): Suivre le cas clinique en priorité, adapter légèrement si nécessaire
                             3. SÉQUENCES IDÉALES: Utiliser UNIQUEMENT quand aucun cas clinique n'a ≥ 80% de similarité
                             4. NE JAMAIS mélanger un cas clinique très similaire avec une séquence idéale générique
                             
                             COMPRÉHENSION DES ABRÉVIATIONS:
                             - F = Facette (traitement esthétique)
                             - CC = Couronne céramique
                             - TR = Traitement de racine
                             - MA = Moignon adhésif
                             - Cpr = Composite
                             
                             Quand un utilisateur décrit un traitement (ex: "12 à 22 F" = facettes de 12 à 22), vous devez:
                             
                             1. Identifier le traitement exact demandé
                             2. Si un cas clinique correspond exactement ou presque (≥ 80%), l'utiliser EXCLUSIVEMENT
                             3. Ne PAS diluer avec des séquences idéales génériques si un cas spécifique existe
                             4. Pour "Plan de TT 12 à 22 F", utiliser le cas clinique exact qui a cette consultation
                             
                             FORMAT DE RÉPONSE REQUIS:
                             
                             Pour les plans de traitement, suivez ce format EXACT:
                             
                             1. D'ABORD, expliquez votre raisonnement clinique en quelques phrases:
                                - Quel cas clinique ou séquence idéale vous utilisez comme référence
                                - Pourquoi cette approche est appropriée
                                - Les adaptations éventuelles nécessaires
                             
                             2. ENSUITE, après une ligne vide, ajoutez le marqueur: ### TREATMENT_PLAN_JSON ###
                             
                             3. ENFIN, fournissez le JSON du plan de traitement:
                             {
                               "consultation_text": "Texte de la consultation basé sur le cas clinique",
                               "treatment_sequence": [
                                 {
                                   "rdv": 1,
                                   "traitement": "Description détaillée du traitement",
                                   "duree": "Durée estimée (ex: 1h30, 2h, 30min)",
                                   "delai": "Délai avant le prochain RDV (ex: 1 sem, 2 jours)",
                                   "dr": "Praticien responsable (ex: VR, NB)",
                                   "date": "",
                                   "remarque": "Notes particulières ou paiements"
                                 }
                               ]
                             }
                             
                             EXEMPLE DE RÉPONSE:
                             Pour votre demande de facettes de 12 à 22, je me base sur le cas clinique "12-22 Fac ant F Christophe" qui correspond exactement. Cette approche en 6 séances permet une préparation optimale avec provisoires et une finalisation soignée.
                             
                             ### TREATMENT_PLAN_JSON ###
                             {
                               "consultation_text": "12 à 22 F",
                               "treatment_sequence": [...]
                             }
                             
                             IMPORTANT: 
                             - Fournissez TOUJOURS le raisonnement avant le JSON
                             - Utilisez EXACTEMENT le marqueur ### TREATMENT_PLAN_JSON ###
                             - Assurez-vous que le JSON est valide
                             - Incluez au minimum 1 appointment dans treatment_sequence
                             
                             IMPORTANT: Pour les traitements spécifiques avec numéros de dents (ex: "12 à 22 F"), TOUJOURS préférer le cas clinique exact plutôt qu'une séquence idéale générique."""
        
        return {
            'dental-brain': SpecializedLLM('dental-brain', prompt, self.rag_service)
        }
    
    def get_completion(self, messages: List[Dict], tab_name: str = None, 
                      temperature: float = 0.7, max_tokens: int = 2000) -> str:
        """Get completion from OpenAI"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error getting AI completion: {str(e)}")
            raise
    
    def _is_treatment_planning_request(self, message: str) -> bool:
        """Detect if message is a treatment planning request"""
        # Common patterns for treatment planning
        patterns = [
            r'\d{1,2}\s*(à|a)\s*\d{1,2}',  # "12 à 24", "11 a 13"
            r'\d{1,2}.*[A-Z]{1,3}',        # "26 CC", "12 F"
            r'Plan\s+de\s+t+',             # "Plan de ttt", "Plan de traitement"
            r'dém\..*CC',                  # "dém. CC"
            r'TR\s+\d+\s+canaux',          # "TR 3 canaux"
            r'MA\s*\+\s*CC',               # "MA + CC"
            r'[A-Z]{1,3}\s*\+\s*[A-Z]{1,3}', # "CC + TR"
            # Modification patterns
            r'ajoute.*\b(après|avant)\b.*séance',  # "ajoute un blanchiment après la séance 3"
            r'modifi.*séance',                      # "modifie la séance"
            r'change.*traitement',                  # "change le traitement"
            r'supprime.*RDV',                       # "supprime le RDV"
            r'enlève.*séance',                      # "enlève la séance"
            r'remplace.*par',                       # "remplace X par Y"
            r'déplace.*séance',                     # "déplace la séance"
            r'fusionne.*séances'                    # "fusionne les séances"
        ]
        
        import re
        for pattern in patterns:
            if re.search(pattern, message, re.IGNORECASE):
                return True
        return False
    
    def _is_treatment_modification_request(self, message: str) -> bool:
        """Detect if message is asking to modify an existing treatment plan"""
        modification_keywords = [
            'ajoute', 'ajouter', 'ajout',
            'modifi', 'modifier', 'modification',
            'change', 'changer',
            'supprime', 'supprimer',
            'enlève', 'enlever',
            'remplace', 'remplacer',
            'déplace', 'déplacer',
            'fusionne', 'fusionner',
            'après', 'avant',
            'séance', 'rdv', 'rendez-vous'
        ]
        
        message_lower = message.lower()
        return any(keyword in message_lower for keyword in modification_keywords)
    
    def _generate_treatment_explanation(self, treatment_plan: Dict, rag_results: Dict, settings: Dict) -> str:
        """Generate a structured explanation from treatment plan"""
        sequence = treatment_plan.get('treatment_sequence', [])
        if not sequence:
            return "Aucune séquence de traitement générée."
        
        # Calculate total duration and sessions
        total_sessions = len(sequence)
        
        # Build structured explanation
        explanation = f"## 📋 Plan de traitement proposé\n\n"
        explanation += f"**Nombre de séances:** {total_sessions}\n\n"
        
        # Add consultation text if available
        if treatment_plan.get('consultation_text'):
            explanation += f"**Demande:** {treatment_plan['consultation_text']}\n\n"
        
        # Summary of key treatments
        explanation += "### 🔍 Résumé des interventions\n\n"
        key_treatments = []
        for rdv in sequence:
            treatment = rdv.get('traitement', '')
            if treatment and treatment not in key_treatments:
                key_treatments.append(treatment)
        
        for i, treatment in enumerate(key_treatments[:5], 1):  # Show first 5 unique treatments
            explanation += f"{i}. {treatment}\n"
        
        if len(key_treatments) > 5:
            explanation += f"... et {len(key_treatments) - 5} autres interventions\n"
        
        # Clinical reasoning based on RAG sources - only if explainReasoning is true
        if settings.get('explainReasoning', True):
            explanation += "\n### 🧠 Raisonnement clinique\n\n"
            
            # Check similarity scores
            best_match = None
            best_score = 0
            
            # Use original results for similarity info
            original_results = rag_results.get('original', rag_results)
            
            for case in original_results.get('clinical_cases', []):
                if case['similarity_score'] > best_score:
                    best_score = case['similarity_score']
                    best_match = case
            
            for seq in original_results.get('ideal_sequences', []):
                if seq['similarity_score'] > best_score:
                    best_score = seq['similarity_score']
                    best_match = seq
            
            if best_match and best_score >= 0.8:
                explanation += f"Ce plan est basé sur {best_match['title']} avec une correspondance de {best_score*100:.0f}%. "
                explanation += "La séquence suit les meilleures pratiques établies.\n"
            elif best_match and best_score >= 0.6:
                explanation += f"Ce plan s'inspire de {best_match['title']} (correspondance: {best_score*100:.0f}%) "
                explanation += "avec des adaptations spécifiques à votre cas.\n"
            else:
                explanation += "Ce plan a été élaboré en combinant plusieurs références cliniques pour répondre "
                explanation += "spécifiquement à vos besoins.\n"
        
        # Timeline highlights
        if total_sessions > 1:
            explanation += "\n### ⏱️ Durée et délais\n\n"
            has_delays = any(rdv.get('delai', '') for rdv in sequence)
            if has_delays:
                explanation += "Le plan inclut des délais spécifiques entre certaines séances pour assurer "
                explanation += "une guérison optimale et le succès du traitement.\n"
            else:
                explanation += "Les séances peuvent être programmées selon votre disponibilité.\n"
        
        return explanation

    def _parse_treatment_response(self, response: str) -> Dict:
        """Parse treatment planning response and extract reasoning and JSON"""
        import json
        import re
        
        logger.debug(f"Parsing treatment response: {response[:200]}...")
        
        # Look for the marker that separates reasoning from JSON (be flexible with format)
        # Note: Order matters - check more specific patterns first
        markers = [
            "### TREATMENT_PLAN_JSON ###",
            "TREATMENT_PLAN_JSON ###",
            "###TREATMENT_PLAN_JSON###",
            "TREATMENT_PLAN_JSON ###",  # With trailing space
            "TREATMENT_PLAN_JSON"
        ]
        
        marker_found = None
        for marker in markers:
            if marker in response:
                marker_found = marker
                break
        
        if marker_found:
            # Split response into reasoning and JSON parts
            parts = response.split(marker_found, 1)
            reasoning_text = parts[0].strip()
            json_part = parts[1].strip() if len(parts) > 1 else ""
            
            logger.debug(f"Found marker: {marker_found}")
            logger.debug(f"Found reasoning text: {reasoning_text[:200]}...")
            logger.debug(f"Found JSON part: {json_part[:200]}...")
            
            # Try to extract JSON from the second part
            # First, clean up any leading/trailing whitespace and newlines
            json_part = json_part.strip()
            json_match = re.search(r'\{.*\}', json_part, re.DOTALL)
            if json_match:
                try:
                    json_text = json_match.group()
                    treatment_plan = json.loads(json_text)
                    
                    # Validate treatment plan structure
                    if 'treatment_sequence' in treatment_plan and isinstance(treatment_plan['treatment_sequence'], list):
                        logger.info(f"Valid treatment plan found with {len(treatment_plan['treatment_sequence'])} appointments")
                        return {
                            'treatment_plan': treatment_plan,
                            'is_treatment_plan': True,
                            'reasoning': reasoning_text
                        }
                    else:
                        logger.warning("JSON found but missing valid treatment_sequence")
                        
                except json.JSONDecodeError as e:
                    logger.error(f"JSON parsing error: {e}")
                    logger.error(f"Failed JSON text: {json_match.group()[:500]}")
        else:
            # Fallback to old method if no marker found
            logger.warning("No TREATMENT_PLAN_JSON marker found in any format, trying legacy parsing")
            
            # Try to find JSON that looks like a treatment plan
            json_matches = re.finditer(r'\{[^{}]*"treatment_sequence"[^{}]*\}', response, re.DOTALL)
            
            for json_match in json_matches:
                try:
                    # Expand the match to get the full JSON object
                    start = json_match.start()
                    # Find the matching closing brace
                    brace_count = 0
                    end = start
                    for i, char in enumerate(response[start:], start):
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                end = i + 1
                                break
                    
                    json_text = response[start:end]
                    treatment_plan = json.loads(json_text)
                    
                    if 'treatment_sequence' in treatment_plan and isinstance(treatment_plan['treatment_sequence'], list):
                        logger.info(f"Valid treatment plan found with {len(treatment_plan['treatment_sequence'])} appointments (legacy)")
                        # Extract any text before JSON as reasoning
                        reasoning_text = response[:start].strip()
                        
                        return {
                            'treatment_plan': treatment_plan,
                            'is_treatment_plan': True,
                            'reasoning': reasoning_text
                        }
                except (json.JSONDecodeError, Exception) as e:
                    logger.debug(f"Failed to parse potential treatment plan: {e}")
                    continue
        
        return {
            'response': response,
            'is_treatment_plan': False
        }
    
    def generate_clinical_protocol(self, treatment_description: str) -> Dict:
        """Generate detailed clinical protocol for a specific treatment"""
        
        # Create specialized protocol generation prompt
        protocol_prompt = """Vous êtes un expert dentiste formateur spécialisé dans la création de protocoles cliniques détaillés.

TÂCHE: Générer un protocole clinique DÉTAILLÉ et ÉTAPE PAR ÉTAPE pour le traitement demandé.

FORMAT REQUIS:
- Utilisez des sections claires (## pour les sections principales, ### pour les sous-sections)
- Numérotez chaque étape (1., 2., 3., etc.)
- Incluez les détails techniques précis (instruments, matériaux, temps, réglages)
- Ajoutez des ⚠️ pour les points critiques de sécurité
- Ajoutez des 💡 pour les astuces pratiques
- Soyez TRÈS spécifique sur les techniques et mouvements

STRUCTURE SUGGÉRÉE:
## Préparation
## Anesthésie
## Étapes cliniques
## Finition
## Contrôles post-opératoires
## Points d'attention

IMPORTANT: Fournissez un protocole que même un jeune dentiste pourrait suivre avec succès."""

        messages = [
            {"role": "system", "content": protocol_prompt},
            {"role": "user", "content": f"Générez un protocole clinique détaillé pour : {treatment_description}"}
        ]
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.3,  # Lower temperature for more consistent protocols
                max_tokens=1500
            )
            
            protocol_content = response.choices[0].message.content
            
            return {
                'response': protocol_content,
                'protocol': protocol_content,
                'references': []  # No RAG needed for protocols
            }
            
        except Exception as e:
            logger.error(f"Error generating protocol: {str(e)}")
            return {
                'response': "Erreur lors de la génération du protocole",
                'references': []
            }
    
    def process_chat_message(self, message: str, tab_name: str, settings: Dict = None, action: str = None, current_treatment_plan: Dict = None) -> Dict:
        """Process a chat message with specialized context"""
        if tab_name not in self.specialized_llms:
            return {
                'response': "Tab non reconnu",
                'references': []
            }
        
        if settings is None:
            settings = {}
        
        llm = self.specialized_llms[tab_name]
        
        # Get specialized context
        rag_results, context = llm.get_specialized_context(message, settings)
        
        # Add current treatment plan to context if it's a modification request
        if current_treatment_plan and self._is_treatment_modification_request(message):
            context += "\n\n--- PLAN DE TRAITEMENT ACTUEL À MODIFIER ---\n"
            context += f"Consultation: {current_treatment_plan.get('consultation_text', 'Non spécifiée')}\n"
            context += "Séquence actuelle:\n"
            for appt in current_treatment_plan.get('treatment_sequence', []):
                context += f"  RDV {appt['rdv']}: {appt['traitement']} ({appt.get('duree', 'N/A')})\n"
                if appt.get('delai'):
                    context += f"    Délai: {appt['delai']}\n"
            context += "\nIMPORTANT: L'utilisateur demande de MODIFIER ce plan existant. Vous devez:\n"
            context += "1. Appliquer les modifications demandées\n"
            context += "2. Garder le reste du plan intact\n"
            context += "3. Renumeroter les RDV si nécessaire\n"
            context += "4. Retourner le plan COMPLET modifié au format JSON habituel\n"
        
        # Format prompt
        system_prompt = llm.format_prompt(message, context)
        
        # Get AI response
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        
        response = self.get_completion(messages, tab_name)
        
        # Update chat history
        llm.chat_history.append({
            'user': message,
            'assistant': response
        })
        
        # Keep history limited
        if len(llm.chat_history) > 10:
            llm.chat_history = llm.chat_history[-10:]
        
        # Handle treatment planning responses specially
        # Check if it's a new treatment plan request OR a modification of existing plan
        is_new_plan = self._is_treatment_planning_request(message)
        is_modification = current_treatment_plan and self._is_treatment_modification_request(message)
        
        if tab_name == 'dental-brain' and (is_new_plan or is_modification):
            logger.info(f"Treatment planning request detected: {message} (new={is_new_plan}, modification={is_modification})")
            parsed_response = self._parse_treatment_response(response)
            logger.info(f"Treatment plan parsing result: is_treatment_plan={parsed_response.get('is_treatment_plan', False)}")
            logger.info(f"Full parsed response keys: {list(parsed_response.keys())}")
            if parsed_response.get('treatment_plan'):
                logger.info(f"Treatment plan found with {len(parsed_response['treatment_plan'].get('treatment_sequence', []))} sequences")
            
            if parsed_response.get('is_treatment_plan') and parsed_response.get('treatment_plan'):
                logger.info(f"Successfully generated treatment plan with {len(parsed_response['treatment_plan'].get('treatment_sequence', []))} appointments")
                
                # Use AI's reasoning if available, otherwise generate our own explanation
                if parsed_response.get('reasoning'):
                    # Use the AI's own reasoning
                    response_text = parsed_response['reasoning']
                    logger.info("Using AI's provided reasoning")
                else:
                    # Fallback to generated explanation
                    explanation = self._generate_treatment_explanation(parsed_response['treatment_plan'], rag_results, settings)
                    response_text = explanation
                    logger.info("Using generated explanation (no AI reasoning found)")
            else:
                logger.warning("Treatment planning detected but no valid treatment plan generated")
                response_text = parsed_response.get('response', response)
                
            return {
                'response': response_text,
                'references': self._format_references(rag_results, settings),
                'is_treatment_plan': parsed_response.get('is_treatment_plan', False),
                'treatment_plan': parsed_response.get('treatment_plan', None)
            }
        
        return {
            'response': response,
            'references': self._format_references(rag_results, settings)
        }
    
    def _format_references(self, rag_results: Dict, settings: Dict) -> List[Dict]:
        """Format enhanced RAG results as references with similarity scores"""
        references = []
        
        # Use filtered results if available, otherwise use original
        results_to_use = rag_results.get('filtered', rag_results)
        original_results = rag_results.get('original', rag_results)
        
        # Add clinical cases
        for case in results_to_use.get('clinical_cases', []):
            ref = {
                'type': 'clinical_case',
                'title': case['title'],
                'id': case['id'],
                'source': case['source'],
                'filename': case['filename'],
                'categories': case.get('categories', [])
            }
            # Include similarity score if user wants to see it
            if settings.get('showSimilarityScores', True):
                ref['similarity_score'] = case['similarity_score']
            references.append(ref)
        
        # Add ideal sequences
        for sequence in results_to_use.get('ideal_sequences', []):
            ref = {
                'type': 'ideal_sequence',
                'title': sequence['title'],
                'id': sequence['id'],
                'source': sequence['source'],
                'filename': sequence['filename'],
                'categories': sequence.get('categories', [])
            }
            if settings.get('showSimilarityScores', True):
                ref['similarity_score'] = sequence['similarity_score']
            references.append(ref)
        
        # Add general knowledge
        for knowledge in results_to_use.get('general_knowledge', []):
            ref = {
                'type': 'general_knowledge',
                'title': knowledge['title'],
                'id': knowledge['id'],
                'source': knowledge['source'],
                'filename': knowledge['filename'],
                'categories': knowledge.get('categories', [])
            }
            if settings.get('showSimilarityScores', True):
                ref['similarity_score'] = knowledge['similarity_score']
            references.append(ref)
        
        # Sort by similarity score (highest first) if scores are shown
        if settings.get('showSimilarityScores', True):
            references.sort(key=lambda x: x.get('similarity_score', 0), reverse=True)
        
        return references