from app.services.ai_service import AIService
from app.services.enhanced_rag_service import EnhancedRAGService

# Service instances
ai_service = None
rag_service = None

def init_services(app):
    """Initialize AI services with app context"""
    global ai_service, rag_service
    
    # Initialize enhanced RAG system first
    rag_service = EnhancedRAGService()
    rag_service.initialize()
    
    # Initialize AI service with RAG
    ai_service = AIService(rag_service)
    
    app.logger.info("AI services initialized successfully")

__all__ = [
    'AIService', 'EnhancedRAGService',
    'init_services',
    'ai_service', 'rag_service'
]