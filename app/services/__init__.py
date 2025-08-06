from app.services.ai_service import AIService
from app.services.enhanced_rag_service import EnhancedRAGService
from app.services.data_service import DataService
import os

# Service instances
ai_service = None
rag_service = None
data_service = None

def init_services(app):
    """Initialize AI services with app context"""
    global ai_service, rag_service, data_service
    
    app.logger.info("Starting services initialization...")
    
    try:
        # Initialize enhanced RAG system first
        app.logger.info("Initializing RAG service...")
        rag_service = EnhancedRAGService()
        rag_service.initialize()
        app.logger.info("RAG service initialized successfully")
        
        # Initialize AI service with RAG
        app.logger.info("Initializing AI service...")
        ai_service = AIService(rag_service)
        app.logger.info("AI service initialized successfully")
        
        # Initialize data service
        # app.root_path points to the 'app' directory, so we need to go up one level to reach DATA
        app.logger.info(f"App root path: {app.root_path}")
        data_dir = os.path.abspath(os.path.join(app.root_path, '..', 'DATA'))
        app.logger.info(f"Looking for DATA directory at: {data_dir}")
        
        if not os.path.exists(data_dir):
            app.logger.error(f"DATA directory not found at: {data_dir}")
            app.logger.error(f"Current working directory: {os.getcwd()}")
            app.logger.error(f"Directory contents: {os.listdir(os.path.dirname(data_dir))}")
            data_service = None
        else:
            try:
                data_service = DataService(data_dir)
                app.logger.info(f"DataService initialized successfully with data_dir: {data_dir}")
                # Log available categories
                categories = data_service.get_categories()
                app.logger.info(f"Available data categories: {[cat['key'] for cat in categories]}")
            except Exception as e:
                app.logger.error(f"Failed to initialize DataService: {str(e)}")
                app.logger.exception("DataService initialization error:")
                data_service = None
        
        app.logger.info("All services initialization completed")
        
    except Exception as e:
        app.logger.error(f"Critical error during services initialization: {str(e)}")
        app.logger.exception("Services initialization error:")
        raise

__all__ = [
    'AIService', 'EnhancedRAGService', 'DataService',
    'init_services',
    'ai_service', 'rag_service', 'data_service'
]