# CLAUDE.md - AI Assistant Guide for Dental Office AI

## 🚀 Quick Start Commands

```bash
# Start the application
python3 run.py
# OR
./start.sh

# Run tests (when implemented)
pytest

# Lint and format code
flake8 app/
black app/

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For development

# Seed database with sample data
python3 seed_database.py

# Database migrations
flask db upgrade

# Fix production database columns (Render deployment)
python quick_fix_columns.py
```

## 🏗️ Architecture Overview

This is a refactored Flask-based dental practice management system with AI capabilities. The codebase was recently restructured from a monolithic 5000+ line app.py into a modular architecture.

### Directory Structure
```
dental-app/
├── app/                      # Flask application package
│   ├── __init__.py          # App factory pattern
│   ├── config.py            # Configuration management
│   ├── models/              # SQLAlchemy ORM models
│   ├── services/            # Business logic layer
│   ├── api/                 # Flask blueprints (routes)
│   └── utils/               # Utilities
├── static/                  # Frontend assets
│   ├── app.js              # Main frontend (being modularized)
│   ├── js/                 # New modular JS structure
│   └── styles.css          # Main stylesheet
├── templates/               # HTML templates
├── DATA/                    # Knowledge base for RAG
├── migrations/              # Database migrations
└── run.py                   # Application entry point
```

### Key Architectural Decisions

1. **Service Layer Pattern**: All business logic is in `app/services/`, keeping routes thin
2. **SQLAlchemy ORM**: Replaced raw SQL queries for better maintainability
3. **Flask Blueprints**: Routes organized by domain (patients, appointments, financial, AI)
4. **Import Guards**: Services check for None to handle initialization order
5. **Frontend Modularization**: Migrating from monolithic app.js to ES6 modules

## 🤖 AI Integration

### AI Models
- **Default Model**: O4-mini (thinking mode) - provides deeper analysis
- **Alternative**: GPT-4o (standard mode) - faster responses
- **Smart Title Generation**: Automatic descriptive conversation titles

### Specialized AI Features
- **Dental Brain**: Clinical decision support and treatment planning
- **Multi-Strategy Search**: Enhanced RAG with keyword extraction and boosting
- **Brain Analysis**: Multi-agent system for discovering clinical patterns
- **Evaluation System**: Dual evaluation (manual + automatic) for quality assurance

### RAG System
- ChromaDB for vector storage
- 51+ dental knowledge articles
- Enhanced search with:
  - Exact match detection (shows 100% similarity)
  - Multi-strategy search for compound queries
  - Separate ranking scores from display scores
  - Visual indicators for similarity thresholds

## 🔧 Common Development Tasks

### Adding a New Feature
1. Create model in `app/models/`
2. Add service methods in `app/services/`
3. Create API endpoints in `app/api/`
4. Update frontend in `static/js/`

### Database Changes
```bash
flask db migrate -m "Description"
flask db upgrade
```

### Testing AI Features
The AI chat expects requests to `/api/ai/chat` with:
```json
{
  "message": "user question",
  "history": [],
  "tab": "dental-brain",
  "settings": {
    "aiModel": "o4-mini",
    "similarityThreshold": 60,
    "showSimilarityScores": true
  }
}
```

## ⚠️ Important Notes

### API Response Format
All API endpoints return:
```json
{
  "status": "success|error",
  "data": {},
  "message": "optional message"
}
```

### Frontend Conventions
- Check `data.status === 'success'` (not `data.success`)
- API endpoints may need trailing slashes
- Use the centralized API client in `static/js/core/api.js`

### Service Initialization
Services may be None during initialization. Always check:
```python
from app.services import patient_service
if patient_service is None:
    return jsonify({'status': 'error', 'message': 'Service not initialized'}), 500
```

### Current Features Status
- ✅ Backend fully modularized
- ✅ Enhanced RAG with multi-strategy search
- ✅ Rule-based enhancement from Brain discoveries
- ✅ Comprehensive evaluation system
- ✅ Production deployment on Render
- 🚧 Frontend modularization in progress
- ❌ No automated tests yet

## 🐛 Common Issues

1. **"Service not initialized" errors**: Check import order in `app/__init__.py`
2. **No data showing**: Run `python seed_database.py`
3. **Chat errors**: Ensure OPENAI_API_KEY is set in .env
4. **Import errors**: Activate virtual environment first
5. **Production column errors**: Run `python quick_fix_columns.py`

## 📝 Git Workflow

Use the automated commit script:
```bash
cursor-commit  # Stages all files and commits with smart message
```

Or manually:
```bash
git add .
git commit -m "Your message

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 🔑 Environment Variables

Required in `.env`:
```
OPENAI_API_KEY=your_key_here
FLASK_ENV=development
DATABASE_URL=sqlite:///dental_ai.db
```

For production (Render):
```
DATABASE_URL=postgres://...  # Auto-configured by Render
OPENAI_API_KEY=your_key_here
FLASK_ENV=production
```

## 📊 Database Schema

Key models:
- **User**: Authentication with conversations and messages
- **Conversation**: Chat sessions with treatment plans
- **Message**: Individual messages with metadata
- **EvaluationTestCase**: Test cases for quality evaluation
- **GeneratedSequence**: AI-generated treatment sequences
- **ManualEvaluation**: Human evaluation scores
- **AutomaticEvaluation**: AI evaluation scores

## 🚀 Performance Considerations

- Frontend app.js is 6000+ lines (needs modularization)
- RAG queries optimized with multi-strategy search
- Similarity scores capped at 100% for clarity
- Database queries use eager loading where appropriate

## 🔒 Security Notes

- Never commit API keys
- Patient data stays local
- No PHI sent to external APIs
- CORS configured for local development only

## 📱 Key UI Pages

- **/** - Main chat interface (dental-brain)
- **/data** - Knowledge base management
- **/brain** - AI pattern discovery system
- **/evaluator** - Sequence evaluation system

## 🆕 Recent Major Updates

1. **Enhanced RAG Search**: Multi-strategy with proper similarity scoring
2. **Rule-Based Enhancement**: Brain-discovered patterns enhance generation
3. **Evaluation System**: Comprehensive quality assessment tools
4. **Production Deployment**: Full Render.com integration
5. **Default AI Model**: O4-mini (thinking mode) for deeper analysis

## 📚 Additional Resources

- Original README.md has feature documentation
- Check `DATA/` for knowledge base structure
- Review `app/services/ai_service.py` for LLM prompts
- See `static/js/core/api.js` for frontend API integration
- Visit `/evaluator` for quality testing tools