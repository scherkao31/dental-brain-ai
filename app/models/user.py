from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from app import db


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    theme = db.Column(db.String(20), default='light')  # 'dark' or 'light'
    settings = db.Column(db.JSON, default=dict)  # User preferences including RAG settings
    
    # Relationships
    conversations = db.relationship('Conversation', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set the user's password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if the provided password matches the hash"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'full_name': self.full_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'theme': self.theme
        }
    
    def __repr__(self):
        return f'<User {self.username}>'


class Conversation(db.Model):
    __tablename__ = 'conversations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Case metadata
    case_type = db.Column(db.String(50))  # 'treatment_planning', 'consultation', 'technical_question', 'follow_up'
    has_treatment_plan = db.Column(db.Boolean, default=False)
    treatment_plan_approved = db.Column(db.Boolean, default=False)
    approval_date = db.Column(db.DateTime)
    approved_by = db.Column(db.String(100))  # Name of approver
    sequence_rating = db.Column(db.Integer)  # Rating given to the sequence (1-10)
    approved_sequence_id = db.Column(db.String(100))  # ID of the approved sequence in data management
    
    # Summary of what was discussed/done
    case_summary = db.Column(db.Text)  # Auto-generated or manual summary
    chief_complaint = db.Column(db.String(500))  # Main reason for consultation
    teeth_involved = db.Column(db.JSON, default=list)  # List of tooth numbers
    procedures_discussed = db.Column(db.JSON, default=list)  # List of procedures
    
    # Status and priority
    status = db.Column(db.String(50), default='active')  # 'active', 'completed', 'archived', 'pending_approval'
    priority = db.Column(db.String(20), default='normal')  # 'low', 'normal', 'high', 'urgent'
    
    # Tags for organization
    tags = db.Column(db.JSON, default=list)  # e.g., ['implant', 'emergency', 'cosmetic']
    
    # Financial summary
    estimated_cost = db.Column(db.Float)
    insurance_coverage = db.Column(db.Float)
    
    # Relationships
    messages = db.relationship('Message', backref='conversation', lazy='dynamic', cascade='all, delete-orphan')
    
    def get_treatment_plan(self):
        """Get the latest treatment plan from messages"""
        for message in self.messages.filter_by(role='assistant').order_by(Message.created_at.desc()):
            if message.message_metadata and message.message_metadata.get('is_treatment_plan'):
                return message.message_metadata.get('treatment_plan')
        return None
    
    def update_case_metadata(self):
        """Auto-update case metadata based on messages"""
        # Check for treatment plans
        treatment_plan = self.get_treatment_plan()
        if treatment_plan:
            self.has_treatment_plan = True
            
            # Extract procedures from treatment plan
            procedures = []
            for appt in treatment_plan.get('treatment_sequence', []):
                if appt.get('traitement') and appt['traitement'] not in procedures:
                    procedures.append(appt['traitement'])
            self.procedures_discussed = procedures
            
            # Try to extract teeth numbers from consultation text
            import re
            consultation = treatment_plan.get('consultation_text', '')
            teeth_pattern = r'\b(\d{1,2})\s*(?:à|a|-)\s*(\d{1,2})\b|\b(\d{2})\b'
            teeth_matches = re.findall(teeth_pattern, consultation)
            teeth = []
            for match in teeth_matches:
                if match[0] and match[1]:  # Range like "12 à 22"
                    start, end = int(match[0]), int(match[1])
                    teeth.extend(list(range(start, end + 1)))
                elif match[2]:  # Single tooth like "26"
                    teeth.append(int(match[2]))
            self.teeth_involved = list(set(teeth))
    
    def to_dict(self, summary=False):
        """Convert conversation to dictionary"""
        data = {
            'id': self.id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': self.is_active,
            'case_type': self.case_type,
            'has_treatment_plan': self.has_treatment_plan,
            'treatment_plan_approved': self.treatment_plan_approved,
            'sequence_rating': self.sequence_rating,
            'approved_sequence_id': self.approved_sequence_id,
            'status': self.status,
            'priority': self.priority,
            'tags': self.tags
        }
        
        if not summary:
            data.update({
                'message_count': self.messages.count(),
                'approval_date': self.approval_date.isoformat() if self.approval_date else None,
                'approved_by': self.approved_by,
                'case_summary': self.case_summary,
                'chief_complaint': self.chief_complaint,
                'teeth_involved': self.teeth_involved,
                'procedures_discussed': self.procedures_discussed,
                'estimated_cost': self.estimated_cost,
                'insurance_coverage': self.insurance_coverage
            })
        
        
        return data
    
    def __repr__(self):
        return f'<Case {self.id}: {self.title}>'


class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Store additional data like treatment plans, references
    message_metadata = db.Column(db.JSON)
    
    def to_dict(self):
        """Convert message to dictionary"""
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'metadata': self.message_metadata
        }
    
    def __repr__(self):
        return f'<Message {self.id}: {self.role}>'