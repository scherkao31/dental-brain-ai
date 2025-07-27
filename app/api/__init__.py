from app.api.main import main_bp
from app.api.ai import ai_bp
from app.api.auth import auth_bp
from app.api.user import user_bp

__all__ = ['main_bp', 'ai_bp', 'auth_bp', 'user_bp']