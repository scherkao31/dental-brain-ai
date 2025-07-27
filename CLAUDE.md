# CLAUDE.md - Dental Brain AI Application

## 🧠 Overview

This is a comprehensive dental practice management system with AI-powered treatment planning, patient management, and financial optimization. The application uses advanced RAG (Retrieval-Augmented Generation) with clinical cases and ideal treatment sequences.

## 🚀 Quick Start

```bash
# 1. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For development

# 3. Set up environment variables
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env

# 4. Initialize/upgrade database
flask db upgrade

# 5. Seed with sample data (optional)
python3 seed_database.py

# 6. Start the application
python3 run.py
# OR
./start.sh

# 7. Access at http://localhost:5010
```

## 📁 Architecture

```
dental-app/
├── app/                      # Flask application
│   ├── __init__.py          # App factory pattern
│   ├── config.py            # Configuration
│   ├── models/              # SQLAlchemy models
│   │   ├── patient.py       # Patient records
│   │   ├── conversation.py  # Chat/case management
│   │   └── message.py       # Chat messages
│   ├── api/                 # API endpoints
│   │   ├── ai.py           # AI chat & search
│   │   ├── patient.py      # Patient management
│   │   └── main.py         # Core endpoints
│   └── services/            # Business logic
│       ├── ai_service.py    # LLM orchestration
│       └── enhanced_rag_service.py  # RAG system
├── static/                  # Frontend assets
│   ├── js/
│   │   ├── core/           # Core utilities
│   │   ├── features/       # Feature modules
│   │   └── chat-app.js     # Main chat interface
│   ├── css/
│   │   ├── chat.css        # Chat interface styles
│   │   ├── patients.css    # Patient page styles
│   │   └── enhanced-schedule.css  # Schedule styles
│   └── style.css           # Global styles
├── templates/              # HTML templates
│   ├── index.html         # Main chat interface
│   └── patients.html      # Patient management
└── DATA/                  # Knowledge base
    ├── TRAITEMENTS_JSON/  # Clinical cases
    └── IDEAL_SEQUENCES_ENHANCED/  # Templates
```

## 🦷 Key Features

### 1. AI-Powered Treatment Planning
- **Smart Title Generation**: Uses GPT-4o-mini to create descriptive conversation titles
- **Clinical Case Matching**: ≥80% similarity threshold for accurate plans
- **Treatment Modifications**: Continuous plan updates through chat
- **Protocol Generation**: Detailed clinical protocols on demand

### 2. Patient Management
- **Simplified Creation**: Only patient number required (auto-generation available)
- **Flexible Records**: Optional first/last names
- **Case Linking**: Conversations linked to patient records
- **Smart Display**: Graceful handling of incomplete data

### 3. Chat Interface Enhancements
- **Collapsible Filters**: Save space with persistent state
- **No Timestamps**: Cleaner conversation list
- **Case Metadata**: Type, status, approval tracking
- **Green Approve Button**: Visual indicator for approvals

### 4. Financial Optimization
- **Optimization Slider**: Adjust treatment sequencing
- **Visual Indicators**: See optimized changes
- **Original vs Optimized**: Track both versions

## 🤖 AI Models (Optimized July 2025)

- **Main LLM**: GPT-4o (faster, cheaper, better than GPT-4-turbo)
- **Title Generation**: GPT-4o-mini (50% cheaper than GPT-3.5-turbo)
- **Temperature**: 0.7 for chat, 0.3 for protocols

## 🔧 Common Tasks

### Database Management
```bash
# Create new migration
flask db migrate -m "Description of changes"

# Apply migrations
flask db upgrade

# Generate unique patient number
curl http://localhost:5010/api/patients/generate-number
```

### Adding Features
1. Create/update models in `app/models/`
2. Create migration: `flask db migrate -m "Add feature X"`
3. Apply migration: `flask db upgrade`
4. Add service logic in `app/services/`
5. Create API endpoints in `app/api/`
6. Update frontend in `static/js/`

### CSS Organization
- `chat.css`: Main chat interface and treatment panels
- `patients.css`: Patient management page (light theme)
- `enhanced-schedule.css`: Schedule and calendar views
- Avoid loading conflicting themes together

## 🎨 UI/UX Guidelines

### Color Scheme
```css
/* Primary colors */
--primary-color: #2563eb;  /* Blue */
--accent-primary: #3b82f6; /* Lighter blue */
--success-color: #10b981;  /* Green for approvals */

/* Background colors */
--bg-primary: #ffffff;     /* White */
--bg-secondary: #f8fafc;   /* Light gray */

/* Text colors */
--text-primary: #1e293b;   /* Dark gray */
--text-secondary: #64748b; /* Medium gray */
```

### Component Patterns
- **Cards**: White background with subtle shadows
- **Buttons**: Rounded corners, hover effects
- **Inputs**: Clean borders, focus states
- **Animations**: Smooth transitions (0.2s)

## 🐛 Recent Fixes & Improvements

### July 2025 Updates
1. **Fixed Patients Page**: Removed dark theme contamination
2. **Removed Chat Timestamps**: More space for content
3. **Smart Titles**: LLM-generated descriptive names
4. **Collapsible Filters**: Better sidebar organization
5. **Simplified Patient Creation**: Only number required
6. **Model Upgrades**: GPT-4o and GPT-4o-mini
7. **Green Approve Button**: Better visual feedback

### Known Issues
- Frontend needs further modularization
- No automated tests yet
- Some CSS duplication between files

## 🔑 Environment Variables

```env
# Required
OPENAI_API_KEY=your_key_here

# Optional
FLASK_ENV=development
DATABASE_URL=sqlite:///dental_ai.db
SECRET_KEY=your-secret-key
```

## 📊 Database Schema

### Core Models
- **User**: Authentication and practice info
- **Patient**: Basic info, contacts, medical notes
- **Conversation**: Cases with metadata
- **Message**: Chat history with treatment plans
- **TreatmentPlan**: Structured sequences
- **TarmedPricing**: Swiss pricing codes

### Relationships
- User → many Patients
- Patient → many Conversations
- Conversation → many Messages
- Message → optional TreatmentPlan

## 🚀 Performance Tips

1. **RAG Optimization**
   - Adjust similarity thresholds
   - Limit result counts in settings
   - Use RAG preference slider

2. **Frontend Performance**
   - Lazy load conversation history
   - Debounce search inputs
   - Cache API responses

3. **Database Queries**
   - Use eager loading for relationships
   - Index frequently queried fields
   - Paginate large result sets

## 🔒 Security Notes

- Never commit `.env` file
- Patient data stays local
- No PHI sent to OpenAI (only treatment descriptions)
- Use environment variables for all secrets
- Regular database backups recommended

## 📈 Future Improvements

1. **Testing Suite**: Add pytest with coverage
2. **Frontend Modularization**: Complete ES6 migration
3. **Real-time Updates**: WebSocket for live changes
4. **Advanced Analytics**: Treatment success tracking
5. **Multi-language**: French/German/Italian support
6. **Mobile App**: React Native companion

## 🛠 Development Workflow

```bash
# Before committing
flake8 app/              # Lint Python
black app/               # Format Python

# Git workflow
git add .
git commit -m "Your message

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 📚 Additional Resources

- Original Flask docs: https://flask.palletsprojects.com/
- SQLAlchemy: https://www.sqlalchemy.org/
- OpenAI API: https://platform.openai.com/docs
- Swiss Tarmed: https://www.tarmed-browser.ch/