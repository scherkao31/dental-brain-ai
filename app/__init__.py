import os
import logging
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from whitenoise import WhiteNoise

from app.config import config

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()

def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_CONFIG', 'development')
    
    app = Flask(__name__, 
                template_folder='../templates',
                static_folder='../static')
    
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    
    # Initialize Flask-Login
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Veuillez vous connecter pour accéder à cette page.'
    
    @login_manager.user_loader
    def load_user(user_id):
        from app.models import User
        return User.query.get(int(user_id))
    
    # Add WhiteNoise for static files in production
    if config_name == 'production':
        app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/')
    
    # Configure logging
    if not app.debug and not app.testing:
        logging.basicConfig(
            level=getattr(logging, app.config['LOG_LEVEL']),
            format='%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        if app.config.get('LOG_FILE'):
            file_handler = logging.FileHandler(app.config['LOG_FILE'])
            file_handler.setLevel(logging.INFO)
            file_handler.setFormatter(logging.Formatter(
                '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
            ))
            app.logger.addHandler(file_handler)
        
        app.logger.info('Dental AI Suite startup')
    
    # Register blueprints
    from app.api import main_bp, ai_bp, auth_bp, user_bp
    from app.api.data import data_bp
    from app.api.brain import brain_bp
    from app.api.test_rag import test_rag_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(user_bp, url_prefix='/api/user')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(data_bp, url_prefix='/api/data')
    app.register_blueprint(brain_bp, url_prefix='/api/brain')
    app.register_blueprint(test_rag_bp)
    
    # Initialize services
    with app.app_context():
        from app.services import init_services
        init_services(app)
        
        # Note: Database initialization is handled by build.sh/init_production_db.py
        # This prevents conflicts with existing database schemas
    
    return app