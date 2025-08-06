#!/usr/bin/env python3
"""
Update the comprehensive knowledge base to include high-scoring approved sequences
"""

import json
import os
from datetime import datetime
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_approved_sequences(data_dir: str = "DATA") -> list:
    """Load approved sequences with rating >= 9"""
    approved_dir = Path(data_dir) / "APPROVED_SEQUENCES"
    high_quality_sequences = []
    
    if not approved_dir.exists():
        logger.warning(f"Approved sequences directory not found: {approved_dir}")
        return []
    
    for filename in approved_dir.glob("approved_sequence_*.json"):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Only include sequences with rating >= 9
            if data.get('use_in_rag', False) and data.get('rating', 0) >= 9:
                # Format for knowledge base
                sequence_entry = {
                    'type': 'approved_sequence',
                    'source': 'user_approved',
                    'filename': filename.name,
                    'title': f"Approved: {data.get('original_prompt', 'Treatment Sequence')}",
                    'consultation_text': data.get('original_prompt', ''),
                    'treatment_sequence': data.get('sequence', []),
                    'rating': data.get('rating'),
                    'approved_by': data.get('approved_by'),
                    'approved_date': data.get('approved_date'),
                    'keywords': data.get('keywords', []),
                    'searchable_content': f"Consultation: {data.get('original_prompt', '')}\n" + 
                                        f"Séquence approuvée avec note {data.get('rating')}/10\n" +
                                        '\n'.join([f"RDV {seq.get('rdv', i+1)}: {seq.get('traitement', '')}" 
                                                 for i, seq in enumerate(data.get('sequence', []))])
                }
                
                high_quality_sequences.append(sequence_entry)
                logger.info(f"Added approved sequence: {filename.name} (rating: {data.get('rating')}/10)")
                
        except Exception as e:
            logger.error(f"Error loading {filename}: {e}")
    
    return high_quality_sequences

def update_comprehensive_knowledge_base():
    """Update the comprehensive knowledge base with approved sequences"""
    knowledge_base_path = Path("DATA/ENHANCED_KNOWLEDGE/comprehensive_knowledge_base.json")
    
    # Load existing knowledge base
    if knowledge_base_path.exists():
        with open(knowledge_base_path, 'r', encoding='utf-8') as f:
            knowledge_base = json.load(f)
    else:
        knowledge_base = {'data': [], 'metadata': {}}
    
    # Remove existing approved sequences to avoid duplicates
    original_count = len(knowledge_base['data'])
    knowledge_base['data'] = [entry for entry in knowledge_base['data'] 
                             if entry.get('type') != 'approved_sequence']
    
    removed_count = original_count - len(knowledge_base['data'])
    if removed_count > 0:
        logger.info(f"Removed {removed_count} existing approved sequences")
    
    # Load and add high-quality approved sequences
    approved_sequences = load_approved_sequences()
    knowledge_base['data'].extend(approved_sequences)
    
    # Update metadata
    if 'metadata' not in knowledge_base:
        knowledge_base['metadata'] = {}
    
    knowledge_base['metadata']['last_updated'] = datetime.now().isoformat()
    knowledge_base['metadata']['total_entries'] = len(knowledge_base['data'])
    knowledge_base['metadata']['approved_sequences'] = len(approved_sequences)
    
    # Save updated knowledge base
    with open(knowledge_base_path, 'w', encoding='utf-8') as f:
        json.dump(knowledge_base, f, indent=2, ensure_ascii=False)
    
    logger.info(f"✅ Updated knowledge base with {len(approved_sequences)} high-quality approved sequences")
    logger.info(f"Total entries: {len(knowledge_base['data'])}")
    
    return len(approved_sequences)

if __name__ == "__main__":
    # Update the knowledge base
    count = update_comprehensive_knowledge_base()
    
    # Trigger reindexing if sequences were added
    if count > 0:
        logger.info("Please restart the application or trigger reindexing to include the approved sequences in RAG")