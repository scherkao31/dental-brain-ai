#!/usr/bin/env python3
"""Debug script to test why references aren't showing for '26 CC'"""

import os
import sys
from dotenv import load_dotenv

# Add the app directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Set up Flask app context
from app import create_app
app = create_app()

with app.app_context():
    from app.services.ai_service import AIService
    from app.services.enhanced_rag_service import EnhancedRAGService
    
    # Initialize services
    rag_service = EnhancedRAGService()
    # IMPORTANT: Must call initialize() to set up collections
    rag_service.initialize()
    ai_service = AIService(rag_service)
    
    # Test queries
    test_queries = [
        "26 CC",
        "Plan de TT 12 à 22 F",
        "couronne céramique 26"
    ]
    
    # Default settings
    settings = {
        'similarityThreshold': 60,
        'clinicalCasesCount': 3,
        'idealSequencesCount': 2,
        'knowledgeCount': 2,
        'showSimilarityScores': True,
        'ragPreference': 0
    }
    
    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"Testing query: '{query}'")
        print('='*60)
        
        # Get specialized context
        llm = ai_service.specialized_llms['dental-brain']
        rag_results, context = llm.get_specialized_context(query, settings)
        
        # Check filtered results
        filtered = rag_results.get('filtered', {})
        
        print(f"\nFiltered Results:")
        print(f"  Clinical cases: {len(filtered.get('clinical_cases', []))}")
        print(f"  Approved sequences: {len(filtered.get('approved_sequences', []))}")
        print(f"  Ideal sequences: {len(filtered.get('ideal_sequences', []))}")
        print(f"  General knowledge: {len(filtered.get('general_knowledge', []))}")
        
        # Show approved sequences details
        if filtered.get('approved_sequences'):
            print(f"\nApproved Sequences Found:")
            for seq in filtered['approved_sequences']:
                print(f"  - {seq['title']} (score: {seq['similarity_score']:.3f})")
        
        # Format references
        references = ai_service._format_references(rag_results, settings)
        print(f"\nTotal formatted references: {len(references)}")
        
        # Group by type
        by_type = {}
        for ref in references:
            ref_type = ref['type']
            if ref_type not in by_type:
                by_type[ref_type] = []
            by_type[ref_type].append(ref)
        
        print("\nReferences by type:")
        for ref_type, refs in by_type.items():
            print(f"  {ref_type}: {len(refs)}")
            for ref in refs[:2]:  # Show first 2 of each type
                score = ref.get('similarity_score', 0)
                print(f"    - {ref['title']} ({score:.3f})")