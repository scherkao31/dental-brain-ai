import os
import json
import logging
import threading
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import defaultdict
import re
from openai import OpenAI
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class BrainService:
    """Multi-Agent AI Brain Service for Deep Dental Knowledge Analysis"""
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.analyses = {}  # Store ongoing analyses
        self.discovered_rules = []  # Persistent rule storage
        self.agent_memory = defaultdict(list)  # Memory for each agent
        logger.info("Multi-agent Brain service initialized")
        
        # Load saved rules if they exist
        self._load_saved_rules()
        
    def _load_saved_rules(self):
        """Load previously discovered rules from storage"""
        try:
            rules_file = os.path.join(os.path.dirname(__file__), '../../DATA/discovered_rules.json')
            if os.path.exists(rules_file):
                with open(rules_file, 'r', encoding='utf-8') as f:
                    self.discovered_rules = json.load(f)
                logger.info(f"Loaded {len(self.discovered_rules)} saved rules")
        except Exception as e:
            logger.error(f"Error loading saved rules: {e}")
            
    def _save_rules(self):
        """Save discovered rules to persistent storage"""
        try:
            rules_file = os.path.join(os.path.dirname(__file__), '../../DATA/discovered_rules.json')
            os.makedirs(os.path.dirname(rules_file), exist_ok=True)
            with open(rules_file, 'w', encoding='utf-8') as f:
                json.dump(self.discovered_rules, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved {len(self.discovered_rules)} rules")
        except Exception as e:
            logger.error(f"Error saving rules: {e}")
    
    def start_analysis(self) -> Dict:
        """Start a new multi-agent analysis"""
        analysis_id = str(uuid.uuid4())
        
        self.analyses[analysis_id] = {
            'id': analysis_id,
            'status': 'running',
            'progress': {
                'percentage': 0,
                'stage': 'Initialisation de l\'analyse...'
            },
            'thoughts': [],
            'new_rules': [],
            'start_time': datetime.now()
        }
        
        # Start analysis in background thread
        analysis_thread = threading.Thread(target=self._run_analysis, args=(analysis_id,))
        analysis_thread.daemon = True
        analysis_thread.start()
        
        return {
            'status': 'success',
            'analysisId': analysis_id,
            'message': 'Analyse multi-agents démarrée'
        }
    
    def _run_analysis(self, analysis_id: str):
        """Run the complete multi-agent analysis pipeline"""
        try:
            analysis = self.analyses[analysis_id]
            
            # Stage 1: Data Collection
            self._update_progress(analysis_id, 5, "Collecte des données...")
            data_chunks = self._collect_data_chunks()
            
            # Stage 2: Scanner Agent - Quick pattern identification
            self._update_progress(analysis_id, 15, "Scanner Agent: Identification des patterns...")
            patterns = self._scanner_agent(analysis_id, data_chunks)
            
            # Stage 3: Analyzer Agent - Deep analysis of patterns
            self._update_progress(analysis_id, 40, "Analyzer Agent: Analyse approfondie...")
            deep_insights = self._analyzer_agent(analysis_id, patterns, data_chunks)
            
            # Stage 4: Synthesizer Agent - Rule generation
            self._update_progress(analysis_id, 65, "Synthesizer Agent: Génération des règles...")
            rules = self._synthesizer_agent(analysis_id, deep_insights)
            
            # Stage 5: Validator Agent - Rule validation
            self._update_progress(analysis_id, 85, "Validator Agent: Validation des règles...")
            validated_rules = self._validator_agent(analysis_id, rules, data_chunks)
            
            # Stage 6: Save and complete
            self._update_progress(analysis_id, 95, "Sauvegarde des résultats...")
            self._save_analysis_results(analysis_id, validated_rules)
            
            # Complete
            self._update_progress(analysis_id, 100, "Analyse terminée")
            analysis['status'] = 'complete'
            
        except Exception as e:
            logger.error(f"Error in analysis {analysis_id}: {e}")
            analysis['status'] = 'error'
            analysis['error'] = str(e)
    
    def _collect_data_chunks(self) -> List[Dict]:
        """Collect and organize data into analyzable chunks"""
        chunks = []
        
        try:
            # Load from TRAITEMENTS_JSON (actual clinical cases)
            cases_dir = os.path.join(os.path.dirname(__file__), '../../DATA/TRAITEMENTS_JSON')
            if os.path.exists(cases_dir):
                for filename in os.listdir(cases_dir):
                    if filename.endswith('.json'):
                        with open(os.path.join(cases_dir, filename), 'r', encoding='utf-8') as f:
                            case = json.load(f)
                            chunks.append({
                                'type': 'clinical_case',
                                'name': filename,
                                'content': case
                            })
            
            # Load ideal sequences
            sequences_dir = os.path.join(os.path.dirname(__file__), '../../DATA/IDEAL_SEQUENCES')
            if os.path.exists(sequences_dir):
                for filename in os.listdir(sequences_dir):
                    if filename.endswith('.json'):
                        with open(os.path.join(sequences_dir, filename), 'r', encoding='utf-8') as f:
                            sequence = json.load(f)
                            chunks.append({
                                'type': 'ideal_sequence',
                                'name': filename,
                                'content': sequence
                            })
            
            # Load approved sequences
            approved_dir = os.path.join(os.path.dirname(__file__), '../../DATA/APPROVED_SEQUENCES')
            if os.path.exists(approved_dir):
                for filename in os.listdir(approved_dir):
                    if filename.endswith('.json'):
                        with open(os.path.join(approved_dir, filename), 'r', encoding='utf-8') as f:
                            sequence = json.load(f)
                            chunks.append({
                                'type': 'approved_sequence',
                                'name': filename,
                                'content': sequence
                            })
            
            # Load from IDEAL_SEQUENCES_JSON (ideal cases given by dentist - very important!)
            ideal_cases_dir = os.path.join(os.path.dirname(__file__), '../../DATA/IDEAL_SEQUENCES_JSON')
            if os.path.exists(ideal_cases_dir):
                for filename in os.listdir(ideal_cases_dir):
                    if filename.endswith('.json'):
                        with open(os.path.join(ideal_cases_dir, filename), 'r', encoding='utf-8') as f:
                            ideal_case = json.load(f)
                            chunks.append({
                                'type': 'dentist_ideal_case',
                                'name': filename,
                                'content': ideal_case
                            })
            
            # Load from IDEAL_SEQUENCES_ENHANCED
            enhanced_dir = os.path.join(os.path.dirname(__file__), '../../DATA/IDEAL_SEQUENCES_ENHANCED')
            if os.path.exists(enhanced_dir):
                for filename in os.listdir(enhanced_dir):
                    if filename.endswith('.json'):
                        with open(os.path.join(enhanced_dir, filename), 'r', encoding='utf-8') as f:
                            enhanced = json.load(f)
                            chunks.append({
                                'type': 'enhanced_sequence',
                                'name': filename,
                                'content': enhanced
                            })
            
            logger.info(f"Collected {len(chunks)} data chunks from multiple sources")
            logger.info(f"Types: {dict([(t, sum(1 for c in chunks if c['type'] == t)) for t in set(c['type'] for c in chunks)])}")
            return chunks
            
        except Exception as e:
            logger.error(f"Error collecting data chunks: {e}")
            return []
    
    def _scanner_agent(self, analysis_id: str, data_chunks: List[Dict]) -> List[Dict]:
        """Scanner Agent: Quickly identify interesting patterns"""
        patterns = []
        
        # Process chunks in batches
        batch_size = 5
        for i in range(0, len(data_chunks), batch_size):
            batch = data_chunks[i:i+batch_size]
            
            # Prepare batch summary
            batch_summary = []
            for chunk in batch:
                if chunk['type'] == 'clinical_case':
                    summary = f"Cas clinique {chunk['name']}: {chunk['content'].get('consultation', '')}"
                elif chunk['type'] in ['ideal_sequence', 'approved_sequence']:
                    treatments = [t.get('traitement', '') for t in chunk['content'].get('steps', [])]
                    summary = f"Séquence {chunk['name']}: {' → '.join(treatments[:5])}"
                else:
                    summary = f"{chunk['type']}: {chunk['name']}"
                batch_summary.append(summary)
            
            prompt = f"""En tant que Scanner Agent spécialisé en analyse dentaire, identifie rapidement les patterns intéressants dans ces données:

{chr(10).join(batch_summary)}

Recherche spécifiquement:
1. Séquences de traitement récurrentes
2. Associations de traitements fréquentes
3. Timings caractéristiques entre rendez-vous
4. Préférences de matériaux
5. Patterns inhabituels ou exceptions

Format de réponse JSON:
{{
  "patterns_found": [
    {{
      "type": "sequence|timing|material|exception",
      "description": "description courte",
      "occurrences": ["ref1", "ref2"],
      "interest_level": "high|medium|low"
    }}
  ],
  "quick_insights": ["insight1", "insight2"]
}}"""

            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.7
                )
                
                result = json.loads(response.choices[0].message.content)
                patterns.extend(result.get('patterns_found', []))
                
                # Log agent thought
                self._add_agent_thought(analysis_id, 'scanner', 
                    f"Analysé {len(batch)} éléments, trouvé {len(result.get('patterns_found', []))} patterns intéressants")
                
                # Small delay to avoid rate limits
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Scanner agent error: {e}")
        
        return patterns
    
    def _analyzer_agent(self, analysis_id: str, patterns: List[Dict], data_chunks: List[Dict]) -> List[Dict]:
        """Analyzer Agent: Deep dive into identified patterns"""
        deep_insights = []
        
        # Group patterns by type for efficient analysis
        patterns_by_type = defaultdict(list)
        for pattern in patterns:
            patterns_by_type[pattern.get('type', 'unknown')].append(pattern)
        
        for pattern_type, type_patterns in patterns_by_type.items():
            # Find relevant data chunks for this pattern type
            relevant_chunks = self._find_relevant_chunks(type_patterns, data_chunks)
            
            prompt = f"""En tant qu'Analyzer Agent expert en dentisterie, effectue une analyse approfondie de ces patterns de type '{pattern_type}':

Patterns identifiés:
{json.dumps(type_patterns, ensure_ascii=False, indent=2)}

Données pertinentes:
{self._summarize_chunks(relevant_chunks[:10])}  

Analyse demandée:
1. Identifie les règles cliniques sous-jacentes
2. Explique le raisonnement médical
3. Trouve les conditions d'application
4. Identifie les exceptions et cas limites
5. Évalue la fiabilité (basée sur le nombre d'occurrences)

Pense étape par étape et sois très précis dans ton analyse."""

            try:
                # Use o1-mini for deep thinking
                response = self.client.chat.completions.create(
                    model="o1-mini",
                    messages=[{"role": "user", "content": prompt}]
                )
                
                insight = {
                    'pattern_type': pattern_type,
                    'analysis': response.choices[0].message.content,
                    'patterns': type_patterns,
                    'evidence_count': len(relevant_chunks)
                }
                deep_insights.append(insight)
                
                # Log agent thought
                self._add_agent_thought(analysis_id, 'analyzer',
                    f"Analyse approfondie du pattern '{pattern_type}' avec {len(relevant_chunks)} preuves")
                
                time.sleep(1)  # Rate limiting
                
            except Exception as e:
                logger.error(f"Analyzer agent error: {e}")
        
        return deep_insights
    
    def _synthesizer_agent(self, analysis_id: str, deep_insights: List[Dict]) -> List[Dict]:
        """Synthesizer Agent: Generate clinical rules from insights"""
        rules = []
        
        for insight in deep_insights:
            prompt = f"""En tant que Synthesizer Agent, transforme cette analyse en règles cliniques claires et applicables:

Type de pattern: {insight['pattern_type']}
Analyse: {insight['analysis']}
Nombre de preuves: {insight['evidence_count']}

Génère des règles au format JSON:
{{
  "rules": [
    {{
      "title": "Titre court et descriptif",
      "type": "pattern|timing|material|dependency|contraindication|success_factor",
      "description": "Description claire de la règle",
      "clinicalReasoning": "Explication du raisonnement clinique",
      "conditions": ["condition1", "condition2"],
      "evidence": ["exemple1", "exemple2"],
      "exceptions": ["exception1"],
      "confidence": 0-100,
      "priority": "high|medium|low"
    }}
  ]
}}

Assure-toi que chaque règle est:
- Claire et actionnable
- Basée sur des preuves solides
- Cliniquement pertinente
- Facilement applicable en pratique"""

            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.5
                )
                
                result = json.loads(response.choices[0].message.content)
                generated_rules = result.get('rules', [])
                
                # Add metadata to each rule
                for rule in generated_rules:
                    rule['id'] = str(uuid.uuid4())
                    rule['discoveredAt'] = datetime.now().isoformat()
                    rule['evidenceCount'] = insight['evidence_count']
                    rule['summary'] = rule['description'][:150] + '...' if len(rule['description']) > 150 else rule['description']
                
                rules.extend(generated_rules)
                
                # Log agent thought
                self._add_agent_thought(analysis_id, 'synthesizer',
                    f"Généré {len(generated_rules)} règles à partir du pattern '{insight['pattern_type']}'")
                
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Synthesizer agent error: {e}")
        
        return rules
    
    def _validator_agent(self, analysis_id: str, rules: List[Dict], data_chunks: List[Dict]) -> List[Dict]:
        """Validator Agent: Test and validate generated rules"""
        validated_rules = []
        
        for rule in rules:
            # Find test cases for validation
            test_cases = self._find_test_cases(rule, data_chunks)
            
            prompt = f"""En tant que Validator Agent, valide cette règle clinique contre des cas réels:

Règle à valider:
{json.dumps(rule, ensure_ascii=False, indent=2)}

Cas de test ({len(test_cases)} cas):
{self._summarize_test_cases(test_cases[:5])}

Effectue les validations suivantes:
1. La règle est-elle cohérente avec les cas observés?
2. Y a-t-il des contre-exemples?
3. La confiance attribuée est-elle justifiée?
4. La règle est-elle suffisamment générale mais pas trop?
5. Y a-t-il des ajustements nécessaires?

Retourne ton analyse et une version validée de la règle."""

            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                
                validation_result = response.choices[0].message.content
                
                # Update rule based on validation
                if "valide" in validation_result.lower() or "confirmé" in validation_result.lower():
                    rule['validated'] = True
                    rule['validationNotes'] = validation_result
                    validated_rules.append(rule)
                    
                    # Log agent thought
                    self._add_agent_thought(analysis_id, 'validator',
                        f"✓ Règle validée: '{rule['title']}' avec {len(test_cases)} cas de test")
                else:
                    # Log rejection
                    self._add_agent_thought(analysis_id, 'validator',
                        f"✗ Règle rejetée: '{rule['title']}' - validation échouée")
                
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Validator agent error: {e}")
        
        return validated_rules
    
    def _update_progress(self, analysis_id: str, percentage: int, stage: str):
        """Update analysis progress"""
        if analysis_id in self.analyses:
            self.analyses[analysis_id]['progress'] = {
                'percentage': percentage,
                'stage': stage
            }
            logger.info(f"Analysis {analysis_id}: {percentage}% - {stage}")
    
    def _add_agent_thought(self, analysis_id: str, agent: str, content: str):
        """Add a thought from an agent"""
        if analysis_id in self.analyses:
            thought = {
                'agent': agent,
                'content': content,
                'timestamp': datetime.now().isoformat()
            }
            self.analyses[analysis_id]['thoughts'].append(thought)
            
            # Also store in agent memory for future reference
            self.agent_memory[agent].append({
                'content': content,
                'timestamp': datetime.now().isoformat(),
                'analysis_id': analysis_id
            })
    
    def _find_relevant_chunks(self, patterns: List[Dict], data_chunks: List[Dict]) -> List[Dict]:
        """Find data chunks relevant to given patterns"""
        relevant = []
        
        for pattern in patterns:
            pattern_refs = pattern.get('occurrences', [])
            for chunk in data_chunks:
                # Check if chunk is referenced in pattern
                if chunk['name'] in str(pattern_refs) or any(ref in chunk['name'] for ref in pattern_refs):
                    relevant.append(chunk)
        
        return list({chunk['name']: chunk for chunk in relevant}.values())  # Remove duplicates
    
    def _find_test_cases(self, rule: Dict, data_chunks: List[Dict]) -> List[Dict]:
        """Find test cases for rule validation"""
        test_cases = []
        
        # Search for cases that might match rule conditions
        rule_keywords = self._extract_keywords(rule)
        
        for chunk in data_chunks:
            chunk_text = json.dumps(chunk['content'], ensure_ascii=False).lower()
            if any(keyword.lower() in chunk_text for keyword in rule_keywords):
                test_cases.append(chunk)
        
        return test_cases[:10]  # Limit to 10 test cases
    
    def _extract_keywords(self, rule: Dict) -> List[str]:
        """Extract keywords from a rule for matching"""
        keywords = []
        
        # Extract from title and description
        text_fields = [rule.get('title', ''), rule.get('description', '')]
        
        for text in text_fields:
            # Extract dental terms
            words = re.findall(r'\b[a-zA-ZÀ-ÿ]+\b', text)
            keywords.extend([w for w in words if len(w) > 3])
        
        return list(set(keywords))
    
    def _summarize_chunks(self, chunks: List[Dict]) -> str:
        """Create a summary of data chunks"""
        summaries = []
        
        for chunk in chunks[:5]:  # Limit to 5 for brevity
            if chunk['type'] == 'clinical_case':
                summary = f"- Cas {chunk['name']}: {chunk['content'].get('consultation', 'N/A')[:100]}..."
            else:
                summary = f"- {chunk['type']} {chunk['name']}"
            summaries.append(summary)
        
        return "\n".join(summaries)
    
    def _summarize_test_cases(self, test_cases: List[Dict]) -> str:
        """Summarize test cases for validation"""
        summaries = []
        
        for case in test_cases:
            if case['type'] == 'clinical_case':
                treatments = case['content'].get('treatments', [])
                summary = f"- {case['name']}: {len(treatments)} traitements"
            else:
                steps = case['content'].get('steps', [])
                summary = f"- {case['name']}: {len(steps)} étapes"
            summaries.append(summary)
        
        return "\n".join(summaries)
    
    def _save_analysis_results(self, analysis_id: str, validated_rules: List[Dict]):
        """Save analysis results"""
        if analysis_id in self.analyses:
            # Prepare rules for RAG indexing
            for rule in validated_rules:
                # Extract keywords for better search
                rule['keywords'] = self._extract_rule_keywords(rule)
                # Format for ChromaDB
                rule['rag_text'] = self._format_rule_for_rag(rule)
            
            # Add new rules to persistent storage
            self.discovered_rules.extend(validated_rules)
            
            # Remove duplicates based on title
            seen_titles = set()
            unique_rules = []
            for rule in self.discovered_rules:
                if rule['title'] not in seen_titles:
                    seen_titles.add(rule['title'])
                    unique_rules.append(rule)
            
            self.discovered_rules = unique_rules
            
            # Save to disk
            self._save_rules()
            
            # Index rules in ChromaDB for RAG
            self._index_rules_in_chromadb(unique_rules)
            
            # Update analysis
            self.analyses[analysis_id]['new_rules'] = validated_rules
    
    def get_analysis_progress(self, analysis_id: str) -> Dict:
        """Get current progress of an analysis"""
        if analysis_id not in self.analyses:
            return {
                'status': 'error',
                'message': 'Analysis not found'
            }
        
        analysis = self.analyses[analysis_id]
        
        # Get new thoughts since last check
        new_thoughts = analysis['thoughts'][-5:]  # Last 5 thoughts
        
        # Get new rules since last check
        new_rules = analysis['new_rules'][-5:]  # Last 5 rules
        
        return {
            'status': 'success',
            'progress': analysis['progress'],
            'isComplete': analysis['status'] == 'complete',
            'newThoughts': new_thoughts,
            'newRules': new_rules
        }
    
    def check_saved_analysis(self) -> Dict:
        """Check if there are saved analysis results"""
        return {
            'status': 'success',
            'hasAnalysis': len(self.discovered_rules) > 0,
            'rules': self.discovered_rules
        }
    
    def get_status(self) -> Dict:
        """Get current status of brain service"""
        return {
            'status': 'ready',
            'discovered_rules_count': len(self.discovered_rules),
            'active_analyses': len([a for a in self.analyses.values() if a['status'] == 'running']),
            'agent_memory_size': {agent: len(memories) for agent, memories in self.agent_memory.items()}
        }
    
    def _extract_rule_keywords(self, rule: Dict) -> List[str]:
        """Extract keywords from rule for better search"""
        keywords = []
        
        # Extract from title, description, conditions
        text_sources = [
            rule.get('title', ''),
            rule.get('description', ''),
            ' '.join(rule.get('conditions', [])),
            rule.get('clinicalReasoning', '')
        ]
        
        for text in text_sources:
            # Extract meaningful dental terms
            words = re.findall(r'\b[a-zA-ZÀ-ÿ]+\b', text.lower())
            keywords.extend([w for w in words if len(w) > 3 and w not in ['pour', 'dans', 'avec', 'sans']])
        
        # Add type as keyword
        if rule.get('type'):
            keywords.append(rule['type'])
        
        return list(set(keywords))
    
    def _format_rule_for_rag(self, rule: Dict) -> str:
        """Format rule for optimal RAG retrieval"""
        parts = []
        
        # Title is most important for retrieval
        parts.append(f"RÈGLE: {rule.get('title', '')}")
        
        # Type and confidence
        parts.append(f"Type: {rule.get('type', '')} | Confiance: {rule.get('confidence', 0)}%")
        
        # Description
        if rule.get('description'):
            parts.append(f"Description: {rule['description']}")
        
        # Conditions
        if rule.get('conditions'):
            parts.append(f"Conditions: {', '.join(rule['conditions'])}")
        
        # Clinical reasoning
        if rule.get('clinicalReasoning'):
            parts.append(f"Raisonnement: {rule['clinicalReasoning']}")
        
        # Keywords for better matching
        if rule.get('keywords'):
            parts.append(f"Mots-clés: {', '.join(rule['keywords'][:10])}")
        
        return '\n'.join(parts)
    
    def _index_rules_in_chromadb(self, rules: List[Dict]):
        """Index discovered rules in ChromaDB for RAG"""
        try:
            # Import here to avoid circular imports
            from app.services import rag_service
            
            if rag_service is None:
                logger.warning("RAG service not available for rule indexing")
                return
            
            # Get or create discovered_rules collection
            collection_name = "discovered_rules"
            
            # Check if collection exists, create if not
            try:
                collection = rag_service.client.get_collection(collection_name)
                # Clear existing rules to avoid duplicates
                collection.delete(where={})
            except:
                collection = rag_service.client.create_collection(
                    name=collection_name,
                    embedding_function=rag_service.embedding_function
                )
            
            # Prepare documents for indexing
            documents = []
            metadatas = []
            ids = []
            
            for rule in rules:
                # Document text for embedding
                doc_text = rule.get('rag_text', self._format_rule_for_rag(rule))
                documents.append(doc_text)
                
                # Metadata for filtering and display
                metadata = {
                    'type': 'discovered_rule',
                    'rule_type': rule.get('type', 'general'),
                    'confidence': rule.get('confidence', 0),
                    'title': rule.get('title', ''),
                    'description': rule.get('description', ''),
                    'clinical_reasoning': rule.get('clinicalReasoning', ''),
                    'conditions': json.dumps(rule.get('conditions', [])),
                    'exceptions': json.dumps(rule.get('exceptions', [])),
                    'evidence': json.dumps(rule.get('evidence', [])),  # Add evidence list
                    'pattern': rule.get('pattern', ''),  # Add pattern
                    'evidence_count': rule.get('evidenceCount', 0),
                    'priority': rule.get('priority', 'medium'),
                    'discovered_at': rule.get('discoveredAt', ''),
                    'keywords': json.dumps(rule.get('keywords', [])[:20])  # Limit keywords
                }
                metadatas.append(metadata)
                
                # Unique ID
                ids.append(rule.get('id', str(uuid.uuid4())))
            
            # Add to ChromaDB
            if documents:
                collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                logger.info(f"Indexed {len(documents)} discovered rules in ChromaDB")
            
        except Exception as e:
            logger.error(f"Error indexing rules in ChromaDB: {e}")
            # Don't fail the whole analysis if indexing fails
            pass