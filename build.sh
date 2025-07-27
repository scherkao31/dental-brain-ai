#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Starting build process..."

# Upgrade pip
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "Creating directories..."
mkdir -p instance
mkdir -p temp
mkdir -p uploads
mkdir -p chroma_db

# Initialize database (handles both migrations and fresh installs)
echo "Initializing database..."
python init_production_db.py

# Initialize RAG system if needed
echo "Initializing RAG system..."
python -c "
from app import create_app
from app.services.enhanced_rag_service import EnhancedRAGService
app = create_app('production')
with app.app_context():
    rag_service = EnhancedRAGService()
    stats = rag_service.get_knowledge_stats()
    print(f'RAG system initialized with {stats[\"total_documents\"]} documents')
"

echo "Build completed successfully!"