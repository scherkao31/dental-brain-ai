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
        self.embedding_function = embedding_functions.OpenAIEmbeddingFunction(
            api_key=os.getenv('OPENAI_API_KEY'),
            model_name="text-embedding-ada-002"
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
            
            # Enhanced collection for all data types
            try:
                self.enhanced_collection = self.client.get_collection(
                    name="enhanced_dental_knowledge",
                    embedding_function=self.embedding_function
                )
                logger.info(f"✅ Loaded enhanced collection with {self.enhanced_collection.count()} items")
            except:
                self.enhanced_collection = self.client.create_collection(
                    name="enhanced_dental_knowledge",
                    embedding_function=self.embedding_function
                )
                logger.info("📦 Created new enhanced collection")
                
                # Index the enhanced knowledge base
                self._index_enhanced_knowledge()
            
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
        """Index the enhanced knowledge base into ChromaDB"""
        if not self.enhanced_knowledge_base or not self.enhanced_knowledge_base['data']:
            logger.warning("No enhanced knowledge base data to index")
            return
        
        documents = []
        metadatas = []
        ids = []
        
        for i, entry in enumerate(self.enhanced_knowledge_base['data']):
            # Use searchable content as the document
            document = entry.get('searchable_content', '')
            
            # Create comprehensive metadata with better titles
            title = entry.get('consultation_text', entry.get('title', 'Untitled'))
            
            # Make ideal sequence titles more descriptive
            if entry.get('type') == 'ideal_sequence':
                filename = entry.get('filename', f'entry_{i}')
                if 'sequence' in filename.lower():
                    # Extract meaningful part from filename
                    clean_filename = filename.replace('_', ' ').replace('.docx', '').replace('.json', '')
                    title = f"{clean_filename} - {title}".strip(' -')
            
            metadata = {
                'filename': entry.get('filename', f'entry_{i}'),
                'type': entry.get('type', 'unknown'),
                'source': entry.get('source', 'unknown'),
                'title': title,
                'content_length': len(document),
                'has_sequence': 'treatment_sequence' in entry,
                'has_enhanced_sequence': 'treatment_sequence_enhanced' in entry
            }
            
            # Add categories if available
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
    
    def search_enhanced_knowledge(self, query: str, n_results: int = 5) -> List[Dict]:
        """Search enhanced knowledge base with similarity scoring"""
        if not self.enhanced_collection:
            logger.warning("Enhanced collection not initialized")
            return []
        
        try:
            # Preprocess query to match indexed content
            # Create a combined query with both original and expanded forms
            original_query = query
            expanded_query = self._expand_abbreviations(query)
            
            # If expansion changed the query, search with both forms
            if original_query != expanded_query:
                logger.info(f"Expanded query: '{original_query}' -> '{expanded_query}'")
                # Create combined searchable content similar to how we index
                searchable_query = f"Consultation: {original_query}\nConsultation étendue: {expanded_query}"
            else:
                searchable_query = query
            
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
                
                # Find original entry for enhanced data
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
            # Preprocess query to match indexed content
            original_query = query
            expanded_query = self._expand_abbreviations(query)
            
            if original_query != expanded_query:
                searchable_query = f"Consultation: {original_query}\nConsultation étendue: {expanded_query}"
            else:
                searchable_query = query
            
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
        """Extract key treatment types from query based on abbreviations"""
        keywords = []
        
        # Check each abbreviation in the query
        for abbrev, full_term in self.abbreviations.items():
            pattern = r'\b' + re.escape(abbrev) + r'\b'
            if re.search(pattern, query, flags=re.IGNORECASE):
                keywords.append(full_term)
                # Also add the abbreviation itself for better matching
                keywords.append(abbrev)
        
        return keywords
    
    def search_combined_with_sources(self, query: str, case_results: int = 3, 
                                    ideal_results: int = 2, knowledge_results: int = 2) -> Dict:
        """Search across all sources with detailed similarity scoring"""
        
        # Search clinical cases
        clinical_cases = self.search_by_type('clinical_case', query, case_results)
        
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
            logger.info(f"  - [{seq['similarity_score']:.3f}] {seq['title']} ({seq['filename']})")
        
        # Strategy 2: Search with extracted treatment keywords
        treatment_keywords = self._extract_treatment_keywords(query)
        if treatment_keywords:
            logger.info(f"Extracted treatment keywords from '{query}': {treatment_keywords}")
        
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
            # Boost scores for priority keyword matches
            for seq in keyword_results:
                seq['boosted_score'] = seq['similarity_score'] * 1.2  # 20% boost
            all_ideal_sequences.extend(keyword_results)
        
        # Then search other keywords if needed
        for keyword in other_keywords[:1]:  # Limit to 1 other keyword
            keyword_results = self.search_by_type('ideal_sequence', keyword, 2)
            logger.info(f"Strategy 2 - Other keyword '{keyword}' found {len(keyword_results)} ideal sequences")
            for seq in keyword_results:
                logger.info(f"  - [{seq['similarity_score']:.3f}] {seq['title']} ({seq['filename']})")
                seq['boosted_score'] = seq['similarity_score']  # No boost
            all_ideal_sequences.extend(keyword_results)
        
        # Remove duplicates and sort by similarity
        seen_ids = set()
        unique_sequences = []
        for seq in all_ideal_sequences:
            if seq['id'] not in seen_ids:
                seen_ids.add(seq['id'])
                # Ensure all sequences have a boosted_score
                if 'boosted_score' not in seq:
                    seq['boosted_score'] = seq['similarity_score']
                unique_sequences.append(seq)
        
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
                if item['id'] not in existing_ids and item['type'] not in ['clinical_case', 'ideal_sequence']:
                    general_knowledge.append(item)
                    if len(general_knowledge) >= knowledge_results:
                        break
        
        return {
            'clinical_cases': clinical_cases,
            'ideal_sequences': ideal_sequences,
            'general_knowledge': general_knowledge,
            'total_results': len(clinical_cases) + len(ideal_sequences) + len(general_knowledge),
            'query': query,
            'sources_used': ['clinical_cases', 'ideal_sequences', 'general_knowledge']
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
                'metadata': metadata
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
            # Delete existing collection
            if self.enhanced_collection:
                self.client.delete_collection(name="enhanced_dental_knowledge")
            
            # Recreate collection
            self.enhanced_collection = self.client.create_collection(
                name="enhanced_dental_knowledge",
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