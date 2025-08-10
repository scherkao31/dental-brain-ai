import os
import json
import logging
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import chromadb
from chromadb.utils import embedding_functions
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class EnhancedRAGService:
    """Enhanced Dental RAG System with multi-source knowledge integration and similarity scoring"""
    
    def __init__(self):
        self.client = chromadb.PersistentClient(path="./chroma_db")
        self.openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        # Initialize embedding function
        # Using text-embedding-3-small for better performance (30-50% improvement over ada-002)
        # Compatible with ChromaDB and provides 1536-dimensional embeddings like ada-002
        self.embedding_function = embedding_functions.OpenAIEmbeddingFunction(
            api_key=os.getenv('OPENAI_API_KEY'),
            model_name="text-embedding-3-small"
        )
        
        # Collections for different data types
        self.enhanced_collection = None
        self.enhanced_knowledge_base = None
        
        # Load dental abbreviations
        self.abbreviations = self._load_abbreviations()
        
    def initialize(self):
        """Initialize or get existing collections with enhanced data"""
        try:
            # Load enhanced knowledge base
            self._load_enhanced_knowledge_base()
            
            # Check if we need to migrate to new embedding model
            collection_name = "enhanced_dental_knowledge_v3"  # v3: consultation-only embeddings with text-embedding-3-small
            old_collection_names = ["enhanced_dental_knowledge", "enhanced_dental_knowledge_v2"]
            
            # Try to get existing v3 collection
            try:
                self.enhanced_collection = self.client.get_collection(
                    name=collection_name,
                    embedding_function=self.embedding_function
                )
                logger.info(f"✅ Loaded enhanced collection v3 with {self.enhanced_collection.count()} items")
            except:
                # Create new v3 collection
                self.enhanced_collection = self.client.create_collection(
                    name=collection_name,
                    embedding_function=self.embedding_function,
                    metadata={"hnsw:space": "cosine"}
                )
                logger.info("📦 Created new enhanced collection v3 with consultation-only embeddings")
                
                # Check and delete old collections
                for old_name in old_collection_names:
                    try:
                        old_collection = self.client.get_collection(name=old_name)
                        old_count = old_collection.count()
                        if old_count > 0:
                            logger.info(f"⚠️ Found old collection '{old_name}' with {old_count} items. Deleting...")
                            self.client.delete_collection(old_name)
                            logger.info(f"✅ Deleted old collection: {old_name}")
                    except:
                        pass  # Old collection doesn't exist
                
                # Index the enhanced knowledge base with new strategy
                self._index_enhanced_knowledge()
                logger.info("✅ Knowledge base indexed with consultation-only embeddings")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error initializing enhanced RAG service: {str(e)}")
            return False
    
    def _load_enhanced_knowledge_base(self):
        """Load the enhanced knowledge base from disk"""
        knowledge_base_file = Path("DATA/ENHANCED_KNOWLEDGE/comprehensive_knowledge_base.json")
        
        if not knowledge_base_file.exists():
            logger.warning(f"Enhanced knowledge base not found at {knowledge_base_file}")
            self.enhanced_knowledge_base = {'data': []}
            return
        
        try:
            with open(knowledge_base_file, 'r', encoding='utf-8') as f:
                self.enhanced_knowledge_base = json.load(f)
            
            logger.info(f"✅ Loaded enhanced knowledge base with {len(self.enhanced_knowledge_base['data'])} entries")
            
        except Exception as e:
            logger.error(f"❌ Error loading enhanced knowledge base: {str(e)}")
            self.enhanced_knowledge_base = {'data': []}
    
    def _index_enhanced_knowledge(self):
        """Index the enhanced knowledge base into ChromaDB - OPTIMIZED for consultation text matching"""
        if not self.enhanced_knowledge_base or not self.enhanced_knowledge_base['data']:
            logger.warning("No enhanced knowledge base data to index")
            return
        
        documents = []
        metadatas = []
        ids = []
        
        for i, entry in enumerate(self.enhanced_knowledge_base['data']):
            # OPTIMIZATION: Use ONLY consultation text for embedding
            # This ensures direct consultation-to-consultation matching
            consultation_text = entry.get('consultation_text', entry.get('title', ''))
            
            if not consultation_text:
                logger.warning(f"Skipping entry {i} - no consultation text found")
                continue
            
            # Create two versions: original and expanded
            original_consultation = consultation_text
            expanded_consultation = self._expand_abbreviations(consultation_text)
            
            # Combine both for better matching flexibility
            # This allows matching both "26 CC + TR" and "26 Couronne céramique + Traitement de racine"
            if original_consultation != expanded_consultation:
                document = f"{original_consultation}\n{expanded_consultation}"
            else:
                document = original_consultation
            
            # Create comprehensive metadata with better titles
            # Use the entry's title if available (especially important for approved sequences)
            title = entry.get('title', consultation_text)
            
            # Make ideal sequence titles more descriptive if no title provided
            if not entry.get('title') and entry.get('type') == 'ideal_sequence':
                filename = entry.get('filename', f'entry_{i}')
                if 'sequence' in filename.lower():
                    # Extract meaningful part from filename
                    clean_filename = filename.replace('_', ' ').replace('.docx', '').replace('.json', '')
                    title = f"{clean_filename} - {consultation_text}".strip(' -')
            
            metadata = {
                'filename': entry.get('filename', f'entry_{i}'),
                'type': entry.get('type', 'unknown'),
                'source': entry.get('source', 'unknown'),
                'title': title,
                'consultation_text': consultation_text,
                'consultation_text_expanded': expanded_consultation,
                'has_sequence': 'treatment_sequence' in entry,
                'has_enhanced_sequence': 'treatment_sequence_enhanced' in entry,
                'entry_index': i  # Store index to retrieve full data later
            }
            
            # Add categories if available (for metadata, not for embedding)
            categories = []
            if 'treatment_sequence_enhanced' in entry:
                for appointment in entry['treatment_sequence_enhanced']:
                    if 'categories' in appointment:
                        categories.extend(appointment['categories'])
            
            metadata['categories'] = ','.join(set(categories)) if categories else ''
            
            documents.append(document)
            metadatas.append(metadata)
            ids.append(f"enhanced_{i}")
        
        # Add documents to collection
        self.enhanced_collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        
        logger.info(f"✅ Indexed {len(documents)} enhanced documents")
    
    def _load_abbreviations(self) -> Dict[str, str]:
        """Load dental abbreviations from JSON file"""
        try:
            abbrev_path = Path("DATA/IDEAL_SEQUENCES/dental_abbreviations.json")
            if abbrev_path.exists():
                with open(abbrev_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('abbreviations', {})
            else:
                logger.warning(f"Abbreviations file not found at {abbrev_path}")
                return {}
        except Exception as e:
            logger.error(f"Error loading abbreviations: {e}")
            return {}
    
    def _expand_abbreviations(self, text: str) -> str:
        """Expand dental abbreviations in text to match indexed content"""
        if not text or not self.abbreviations:
            return text
        
        expanded = text
        
        # Sort by length (longest first) to avoid partial replacements
        sorted_abbrevs = sorted(self.abbreviations.items(), key=lambda x: len(x[0]), reverse=True)
        
        for abbrev, full_term in sorted_abbrevs:
            # Replace whole words only
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            expanded = re.sub(pattern, full_term, expanded, flags=re.IGNORECASE)
        
        return expanded
    
    def search_discovered_rules(self, query: str, n_results: int = 5,
                              confidence_threshold: int = 60) -> List[Dict]:
        """Search discovered rules from Brain analysis"""
        try:
            # Get discovered rules collection
            collection = self.client.get_collection("discovered_rules")
            
            # Preprocess query
            searchable_query = self._expand_abbreviations(query.strip())
            
            # Search with confidence filter
            results = collection.query(
                query_texts=[searchable_query],
                n_results=n_results * 2,  # Get more to filter by confidence
                where={"confidence": {"$gte": confidence_threshold}}
            )
            
            # Format and sort by confidence
            formatted_results = []
            if results['ids'] and results['ids'][0]:
                for idx in range(len(results['ids'][0])):
                    metadata = results['metadatas'][0][idx]
                    similarity_score = 1 - results['distances'][0][idx]
                    formatted_results.append({
                        'id': results['ids'][0][idx],
                        'type': 'discovered_rule',
                        'rule_type': metadata.get('rule_type', 'general'),
                        'title': metadata.get('title', ''),
                        'description': metadata.get('description', ''),
                        'clinical_reasoning': metadata.get('clinical_reasoning', ''),
                        'confidence': metadata.get('confidence', 0),
                        'conditions': json.loads(metadata.get('conditions', '[]')),
                        'exceptions': json.loads(metadata.get('exceptions', '[]')),
                        'evidence': json.loads(metadata.get('evidence', '[]')),  # Add evidence
                        'pattern': metadata.get('pattern', ''),  # Add pattern
                        'priority': metadata.get('priority', 'medium'),
                        'score': similarity_score,
                        'similarity_score': similarity_score,  # Add for consistency
                        'document': results['documents'][0][idx]
                    })
            
            # Sort by relevance score * confidence
            formatted_results.sort(key=lambda x: x['score'] * (x['confidence'] / 100), reverse=True)
            
            return formatted_results[:n_results]
            
        except Exception as e:
            logger.error(f"Error searching discovered rules: {e}")
            return []
    
    def search_enhanced_knowledge(self, query: str, n_results: int = 5) -> List[Dict]:
        """Search enhanced knowledge base with similarity scoring"""
        if not self.enhanced_collection:
            logger.warning("Enhanced collection not initialized")
            return []
        
        try:
            # Preprocess query to match indexed content
            # OPTIMIZATION: Match the new indexing strategy
            original_query = query.strip()
            expanded_query = self._expand_abbreviations(original_query)
            
            # Match the document structure we use during indexing
            if original_query != expanded_query:
                logger.info(f"Query expansion: '{original_query}' -> '{expanded_query}'")
                # Use the same format as indexed documents
                searchable_query = f"{original_query}\n{expanded_query}"
            else:
                searchable_query = original_query
            
            # Search in enhanced collection
            results = self.enhanced_collection.query(
                query_texts=[searchable_query],
                n_results=n_results
            )
            
            # Format results with similarity scores and enhanced data
            formatted_results = []
            
            for i in range(len(results['ids'][0])):
                result_id = results['ids'][0][i]
                metadata = results['metadatas'][0][i]
                document = results['documents'][0][i]
                distance = results['distances'][0][i]
                
                # Calculate similarity score (1 - distance for cosine similarity)
                similarity_score = 1 - distance
                
                # Find original entry for enhanced data using stored index
                entry_index = metadata.get('entry_index', int(result_id.split('_')[1]))
                original_entry = self.enhanced_knowledge_base['data'][entry_index]
                
                # Log high similarity matches for debugging
                if similarity_score >= 0.95:
                    logger.info(f"🎯 High similarity match ({similarity_score:.3f}): '{metadata.get('consultation_text', '')}' for query '{query}'")
                
                formatted_result = {
                    'id': result_id,
                    'title': metadata['title'],
                    'content': document,  # This now contains only consultation text
                    'consultation_text': metadata.get('consultation_text', ''),
                    'consultation_text_expanded': metadata.get('consultation_text_expanded', ''),
                    'similarity_score': similarity_score,
                    'type': metadata['type'],
                    'source': metadata['source'],
                    'filename': metadata['filename'],
                    'categories': metadata['categories'].split(',') if metadata['categories'] else [],
                    'enhanced_data': original_entry,  # This contains the full sequence
                    'metadata': metadata
                }
                
                formatted_results.append(formatted_result)
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"❌ Error searching enhanced knowledge: {str(e)}")
            return []
    
    def search_by_category(self, category: str, n_results: int = 5) -> List[Dict]:
        """Search by treatment category"""
        if not self.enhanced_collection:
            return []
        
        try:
            # Search with category filter
            results = self.enhanced_collection.query(
                query_texts=[category],
                n_results=n_results,
                where={"categories": {"$contains": category}}
            )
            
            return self._format_search_results(results)
            
        except Exception as e:
            logger.error(f"❌ Error searching by category: {str(e)}")
            return []
    
    def search_by_type(self, search_type: str, query: str, n_results: int = 5) -> List[Dict]:
        """Search by data type (clinical_case or ideal_sequence)"""
        if not self.enhanced_collection:
            return []
        
        try:
            # Preprocess query to match indexed content (same as search_enhanced_knowledge)
            original_query = query.strip()
            expanded_query = self._expand_abbreviations(original_query)
            
            # Match the document structure we use during indexing
            if original_query != expanded_query:
                searchable_query = f"{original_query}\n{expanded_query}"
            else:
                searchable_query = original_query
            
            results = self.enhanced_collection.query(
                query_texts=[searchable_query],
                n_results=n_results,
                where={"type": {"$eq": search_type}}
            )
            
            return self._format_search_results(results)
            
        except Exception as e:
            logger.error(f"❌ Error searching by type: {str(e)}")
            return []
    
    def _extract_treatment_keywords(self, query: str) -> List[str]:
        """Extract key treatment types from query"""
        keywords = []
        query_lower = query.lower()
        
        # First, check for common treatment terms directly in the query
        common_treatments = [
            'facette', 'composite', 'couronne', 'onlay', 'inlay', 'extraction',
            'implant', 'endodontie', 'traitement de racine', 'tr', 'cc', 'détartrage',
            'blanchiment', 'prothèse', 'bridge', 'pont', 'obturation', 'scellement'
        ]
        
        for treatment in common_treatments:
            if treatment in query_lower:
                # Add the treatment term with proper case
                if treatment == 'cc':
                    keywords.append('Couronne céramique')
                elif treatment == 'tr':
                    keywords.append('Traitement de racine')
                else:
                    keywords.append(treatment.title() if len(treatment) > 2 else treatment.upper())
        
        # Then check each abbreviation in the query
        for abbrev, full_term in self.abbreviations.items():
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            if re.search(pattern, query, flags=re.IGNORECASE):
                if full_term not in keywords:
                    keywords.append(full_term)
                # Also add the abbreviation itself for better matching
                if abbrev not in keywords:
                    keywords.append(abbrev)
        
        return keywords
    
    def search_combined_with_sources(self, query: str, case_results: int = 3, 
                                    ideal_results: int = 2, knowledge_results: int = 2) -> Dict:
        """Search across all sources with detailed similarity scoring"""
        
        # Extract treatment keywords first (needed for all searches)
        treatment_keywords = self._extract_treatment_keywords(query)
        if treatment_keywords:
            logger.info(f"Extracted treatment keywords from '{query}': {treatment_keywords}")
        
        # For queries like "26 CC", also add the tooth+treatment combination
        tooth_pattern = re.match(r'^(\d{1,2})\s+(\w+)', query)
        if tooth_pattern:
            tooth_num = tooth_pattern.group(1)
            treatment_code = tooth_pattern.group(2)
            combined_keyword = f"{tooth_num} {treatment_code}"
            if combined_keyword not in treatment_keywords:
                treatment_keywords.insert(0, combined_keyword)  # Priority to exact combination
                logger.info(f"Added tooth+treatment combination: '{combined_keyword}'")
        
        # Search clinical cases
        clinical_cases = self.search_by_type('clinical_case', query, case_results)
        
        # Search approved sequences with enhanced multi-strategy approach
        all_approved_sequences = []
        
        # Strategy 1: Search with full query
        approved_sequences = self.search_by_type('approved_sequence', query, case_results)
        for seq in approved_sequences:
            # Apply boosting based on exact match with query or keywords
            consultation_text = seq.get('consultation_text', '').lower().strip()
            query_lower = query.lower().strip()
            
            # Check for exact matches with query or its components
            if consultation_text == query_lower:
                seq['boosted_score'] = seq['similarity_score'] * 2.0
                seq['boost_reason'] = 'exact_query_match'
            elif any(keyword.lower() == consultation_text for keyword in treatment_keywords):
                seq['boosted_score'] = seq['similarity_score'] * 2.0
                seq['boost_reason'] = 'exact_keyword_match'
            elif any(keyword.lower() in consultation_text for keyword in treatment_keywords[:2]):
                # Check if this is a primary treatment (short consultation text with keyword)
                if len(consultation_text.split()) <= 5:
                    seq['boosted_score'] = seq['similarity_score'] * 1.5
                    seq['boost_reason'] = 'primary_treatment'
                else:
                    seq['boosted_score'] = seq['similarity_score'] * 1.2
                    seq['boost_reason'] = 'keyword_present'
            else:
                seq['boosted_score'] = seq['similarity_score']
                
        all_approved_sequences.extend(approved_sequences)
        logger.info(f"Approved sequences - Strategy 1 (full query) found {len(approved_sequences)} results")
        
        # Strategy 2: Search with extracted keywords (especially important for compound queries)
        if treatment_keywords:
            seen_ids = {seq['id'] for seq in approved_sequences}
            
            for keyword in treatment_keywords[:2]:  # Top 2 keywords
                keyword_results = self.search_by_type('approved_sequence', keyword, 3)
                logger.info(f"Approved sequences - Strategy 2 (keyword '{keyword}') found {len(keyword_results)} results")
                
                for seq in keyword_results:
                    if seq['id'] not in seen_ids:
                        # Boost scores for keyword matches
                        consultation_text = seq.get('consultation_text', '').lower().strip()
                        keyword_lower = keyword.lower().strip()
                        
                        # Also check with expanded version of keyword
                        keyword_expanded = self._expand_abbreviations(keyword).lower().strip()
                        
                        # Check various exact match patterns
                        exact_match_patterns = [
                            consultation_text == keyword_lower,
                            consultation_text == keyword_expanded,
                            consultation_text == f"{keyword_lower} ({keyword_expanded})",
                            consultation_text.startswith(f"{keyword_lower} (") and ")" in consultation_text,
                            # Check if it's a tooth number + keyword pattern (e.g., "26 CC")
                            re.match(r'^\d{1,2}\s+' + re.escape(keyword_lower) + r'(\s|$)', consultation_text) is not None,
                            # Also check with expanded abbreviation (e.g., "26 couronne céramique")
                            re.match(r'^\d{1,2}\s+' + re.escape(keyword_expanded) + r'(\s|$)', consultation_text) is not None
                        ]
                        
                        if any(exact_match_patterns):
                            seq['boosted_score'] = seq['similarity_score'] * 2.0  # Exact match
                            seq['boost_reason'] = 'exact_match'
                            logger.info(f"  🎯 Exact match boost: '{consultation_text}' matches '{keyword_lower}'")
                        elif keyword_lower in consultation_text and len(consultation_text.split()) <= 5:
                            seq['boosted_score'] = seq['similarity_score'] * 1.5  # Primary treatment
                            seq['boost_reason'] = 'primary_treatment'
                            logger.info(f"  ⭐ Primary treatment boost: '{keyword_lower}' in '{consultation_text}'")
                        else:
                            seq['boosted_score'] = seq['similarity_score'] * 1.2  # Keyword match
                            seq['boost_reason'] = 'keyword_match'
                        
                        logger.info(f"    - [{seq['similarity_score']:.3f} → {seq['boosted_score']:.3f}] {seq.get('title', 'Unknown')}")
                        all_approved_sequences.append(seq)
                        seen_ids.add(seq['id'])
        
        # Sort by boosted score and take top results
        approved_sequences = sorted(all_approved_sequences, 
                                  key=lambda x: x.get('boosted_score', x['similarity_score']), 
                                  reverse=True)[:case_results]
        
        # Log final approved sequences with their scores
        logger.info(f"Final approved sequences after multi-strategy search:")
        for seq in approved_sequences:
            boost_info = f" (boosted from {seq['similarity_score']:.3f})" if seq.get('boosted_score') != seq['similarity_score'] else ""
            logger.info(f"  - [{seq.get('boosted_score', seq['similarity_score']):.3f}{boost_info}] {seq['title']}")
        
        # Search ideal sequences with multiple strategies
        all_ideal_sequences = []
        
        # Strategy 1: Search with full query
        ideal_sequences = self.search_by_type('ideal_sequence', query, ideal_results)
        # No boost for full query results
        for seq in ideal_sequences:
            seq['boosted_score'] = seq['similarity_score']
        all_ideal_sequences.extend(ideal_sequences)
        logger.info(f"Strategy 1 - Full query '{query}' found {len(ideal_sequences)} ideal sequences")
        for seq in ideal_sequences[:3]:
            consultation_text = seq.get('consultation_text', seq.get('title', ''))
            logger.info(f"  - [{seq['similarity_score']:.3f}] Consultation: '{consultation_text}' | File: {seq['filename']}")
        
        # Strategy 2: Search with extracted treatment keywords (already extracted above)
        
        # Prioritize specific treatment types (like Facette) over generic terms
        priority_keywords = []
        other_keywords = []
        for keyword in treatment_keywords:
            # Keywords that are actual treatment types get priority
            if keyword in ['Facette', 'Composite', 'Couronne', 'Onlay', 'Inlay', 'Extraction', 
                          'Implant', 'Endodontie', 'Traitement de racine']:
                priority_keywords.append(keyword)
            else:
                other_keywords.append(keyword)
        
        # Search priority keywords first
        for keyword in priority_keywords[:2]:  # Limit to top 2 priority keywords
            keyword_results = self.search_by_type('ideal_sequence', keyword, 3)
            logger.info(f"Strategy 2 - Priority keyword '{keyword}' found {len(keyword_results)} ideal sequences")
            for seq in keyword_results:
                logger.info(f"  - [{seq['similarity_score']:.3f}] {seq['title']} ({seq['filename']})")
            
            # SMARTER BOOSTING LOGIC
            for seq in keyword_results:
                # Get the actual consultation text from enhanced_data
                enhanced_data = seq.get('enhanced_data', {})
                consultation_text = enhanced_data.get('consultation_text', '')
                
                # If not in enhanced_data, try the direct field
                if not consultation_text:
                    consultation_text = seq.get('consultation_text', '')
                
                consultation_text = consultation_text.lower().strip()
                keyword_lower = keyword.lower().strip()
                
                # Check for exact match
                if consultation_text == keyword_lower:
                    # EXACT MATCH: 100% boost (2x multiplier)
                    seq['boosted_score'] = seq['similarity_score'] * 2.0
                    seq['boost_reason'] = 'exact_match'
                    logger.info(f"    🎯 Exact match boost applied: {seq['similarity_score']:.3f} → {seq['boosted_score']:.3f}")
                
                # Check if consultation is primarily about this treatment
                elif keyword_lower in consultation_text and len(consultation_text.split()) <= 3:
                    # PRIMARY TREATMENT: 50% boost (1.5x multiplier)
                    seq['boosted_score'] = seq['similarity_score'] * 1.5
                    seq['boost_reason'] = 'primary_treatment'
                    logger.info(f"    ⭐ Primary treatment boost applied: {seq['similarity_score']:.3f} → {seq['boosted_score']:.3f}")
                
                # Standard keyword match
                else:
                    # KEYWORD PRESENT: 20% boost (1.2x multiplier)
                    seq['boosted_score'] = seq['similarity_score'] * 1.2
                    seq['boost_reason'] = 'keyword_match'
                    
            all_ideal_sequences.extend(keyword_results)
        
        # Then search other keywords if needed
        for keyword in other_keywords[:1]:  # Limit to 1 other keyword
            keyword_results = self.search_by_type('ideal_sequence', keyword, 2)
            logger.info(f"Strategy 2 - Other keyword '{keyword}' found {len(keyword_results)} ideal sequences")
            for seq in keyword_results:
                logger.info(f"  - [{seq['similarity_score']:.3f}] {seq['title']} ({seq['filename']})")
                seq['boosted_score'] = seq['similarity_score']  # No boost
            all_ideal_sequences.extend(keyword_results)
        
        # Remove duplicates keeping the highest boosted score version
        best_sequences = {}
        for seq in all_ideal_sequences:
            # Ensure all sequences have a boosted_score
            if 'boosted_score' not in seq:
                seq['boosted_score'] = seq['similarity_score']
            
            # Keep the version with the highest boosted score
            seq_id = seq['id']
            if seq_id not in best_sequences or seq['boosted_score'] > best_sequences[seq_id]['boosted_score']:
                best_sequences[seq_id] = seq
        
        unique_sequences = list(best_sequences.values())
        
        logger.info(f"Total unique ideal sequences before sorting: {len(unique_sequences)}")
        
        # Sort by boosted score and keep top results
        ideal_sequences = sorted(unique_sequences, key=lambda x: x.get('boosted_score', x['similarity_score']), reverse=True)[:ideal_results]
        logger.info(f"Final ideal sequences after sorting and limiting to {ideal_results}:")
        for seq in ideal_sequences:
            logger.info(f"  - [{seq['similarity_score']:.3f}] (boosted: {seq.get('boosted_score', seq['similarity_score']):.3f}) {seq['title']} ({seq['filename']})")
        
        # Search general knowledge (excluding clinical cases and ideal sequences to avoid duplicates)
        general_knowledge = []
        if knowledge_results > 0:
            # Get all results first
            all_knowledge = self.search_enhanced_knowledge(query, knowledge_results * 2)
            
            # Filter out duplicates (exclude clinical_case and ideal_sequence types)
            existing_ids = {item['id'] for item in clinical_cases + ideal_sequences}
            
            for item in all_knowledge:
                if item['id'] not in existing_ids and item['type'] not in ['clinical_case', 'ideal_sequence', 'approved_sequence']:
                    general_knowledge.append(item)
                    if len(general_knowledge) >= knowledge_results:
                        break
        
        return {
            'clinical_cases': clinical_cases,
            'approved_sequences': approved_sequences,
            'ideal_sequences': ideal_sequences,
            'general_knowledge': general_knowledge,
            'total_results': len(clinical_cases) + len(approved_sequences) + len(ideal_sequences) + len(general_knowledge),
            'query': query,
            'sources_used': ['clinical_cases', 'approved_sequences', 'ideal_sequences', 'general_knowledge']
        }
    
    def _format_search_results(self, results) -> List[Dict]:
        """Format search results with similarity scores and enhanced data"""
        formatted_results = []
        
        if not results['ids'] or not results['ids'][0]:
            return formatted_results
        
        for i in range(len(results['ids'][0])):
            result_id = results['ids'][0][i]
            metadata = results['metadatas'][0][i]
            document = results['documents'][0][i]
            distance = results['distances'][0][i]
            
            # Calculate similarity score
            similarity_score = 1 - distance
            
            # Find original entry
            entry_index = int(result_id.split('_')[1])
            original_entry = self.enhanced_knowledge_base['data'][entry_index]
            
            formatted_result = {
                'id': result_id,
                'title': metadata['title'],
                'content': document,
                'similarity_score': similarity_score,
                'type': metadata['type'],
                'source': metadata['source'],
                'filename': metadata['filename'],
                'categories': metadata['categories'].split(',') if metadata['categories'] else [],
                'enhanced_data': original_entry,
                'metadata': metadata,
                'consultation_text': metadata.get('consultation_text', '')  # Add for consistency
            }
            
            formatted_results.append(formatted_result)
        
        return formatted_results
    
    def get_detailed_reference(self, reference_id: str) -> Optional[Dict]:
        """Get detailed information about a specific reference"""
        if not self.enhanced_knowledge_base or not self.enhanced_knowledge_base['data']:
            return None
        
        try:
            # Extract entry index from reference ID
            entry_index = int(reference_id.split('_')[1])
            
            if entry_index < len(self.enhanced_knowledge_base['data']):
                entry = self.enhanced_knowledge_base['data'][entry_index]
                
                return {
                    'id': reference_id,
                    'filename': entry.get('filename', 'Unknown'),
                    'type': entry.get('type', 'unknown'),
                    'source': entry.get('source', 'unknown'),
                    'title': entry.get('consultation_text', entry.get('title', 'Untitled')),
                    'original_content': entry.get('content', ''),
                    'enhanced_content': entry.get('searchable_content', ''),
                    'consultation_text': entry.get('consultation_text', ''),
                    'consultation_text_expanded': entry.get('consultation_text_expanded', ''),
                    'treatment_sequence': entry.get('treatment_sequence', []),
                    'treatment_sequence_enhanced': entry.get('treatment_sequence_enhanced', []),
                    'metadata': entry.get('metadata', {}),
                    'stats': entry.get('stats', {})
                }
            
        except Exception as e:
            logger.error(f"❌ Error getting detailed reference: {str(e)}")
        
        return None
    
    def get_statistics(self) -> Dict:
        """Get statistics about the enhanced knowledge base"""
        if not self.enhanced_knowledge_base:
            return {
                'total_entries': 0,
                'clinical_cases': 0,
                'ideal_sequences': 0,
                'status': 'not_initialized'
            }
        
        data = self.enhanced_knowledge_base['data']
        
        clinical_cases = sum(1 for entry in data if entry.get('type') == 'clinical_case')
        ideal_sequences = sum(1 for entry in data if entry.get('type') == 'ideal_sequence')
        
        return {
            'total_entries': len(data),
            'clinical_cases': clinical_cases,
            'ideal_sequences': ideal_sequences,
            'collection_count': self.enhanced_collection.count() if self.enhanced_collection else 0,
            'status': 'initialized'
        }
    
    def reindex_all(self):
        """Reindex all enhanced knowledge"""
        try:
            collection_name = "enhanced_dental_knowledge_v3"  # Use v3 for consultation-only embeddings
            
            # Delete existing collection
            if self.enhanced_collection:
                self.client.delete_collection(name=collection_name)
            
            # Recreate collection with new embeddings
            self.enhanced_collection = self.client.create_collection(
                name=collection_name,
                embedding_function=self.embedding_function
            )
            
            # Reload and reindex
            self._load_enhanced_knowledge_base()
            self._index_enhanced_knowledge()
            
            return {
                'success': True,
                'message': 'Enhanced knowledge base reindexed successfully',
                'entries': len(self.enhanced_knowledge_base['data'])
            }
            
        except Exception as e:
            logger.error(f"❌ Error reindexing: {str(e)}")
            return {
                'success': False,
                'message': str(e)
            }