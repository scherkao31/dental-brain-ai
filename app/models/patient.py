from datetime import datetime
from app import db


class Patient(db.Model):
    __tablename__ = 'patients'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # Which dentist owns this patient
    
    # Basic information
    patient_number = db.Column(db.String(50), nullable=False)  # Unique patient ID within practice
    first_name = db.Column(db.String(100), nullable=True, default='')
    last_name = db.Column(db.String(100), nullable=True, default='')
    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(10))  # 'M', 'F', 'Other'
    
    # Contact information
    email = db.Column(db.String(120))
    phone = db.Column(db.String(50))
    mobile = db.Column(db.String(50))
    address = db.Column(db.Text)
    postal_code = db.Column(db.String(20))
    city = db.Column(db.String(100))
    country = db.Column(db.String(100), default='Suisse')
    
    # Medical information
    allergies = db.Column(db.Text)
    medical_notes = db.Column(db.Text)
    insurance_info = db.Column(db.JSON)  # Store insurance details as JSON
    
    # Administrative
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_visit = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # Tags for quick filtering
    tags = db.Column(db.JSON, default=list)  # e.g., ['VIP', 'Orthodontie', 'Implants']
    
    # Relationships
    cases = db.relationship('Conversation', backref='patient', lazy='dynamic')
    
    # Create unique constraint for patient_number per user
    __table_args__ = (
        db.UniqueConstraint('user_id', 'patient_number', name='_user_patient_number_uc'),
    )
    
    @property
    def full_name(self):
        """Return the full name of the patient"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}".strip()
        elif self.last_name:
            return self.last_name
        elif self.first_name:
            return self.first_name
        else:
            return self.patient_number
    
    @property
    def display_name(self):
        """Return a display name with patient number"""
        if self.first_name or self.last_name:
            name = self.full_name
            if name != self.patient_number:
                return f"{self.patient_number} - {name}"
        return self.patient_number
    
    @property
    def age(self):
        """Calculate patient age"""
        if self.date_of_birth:
            today = datetime.today()
            return today.year - self.date_of_birth.year - (
                (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
            )
        return None
    
    def to_dict(self, include_cases=False):
        """Convert patient to dictionary"""
        data = {
            'id': self.id,
            'patient_number': self.patient_number,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'display_name': self.display_name,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'age': self.age,
            'gender': self.gender,
            'email': self.email,
            'phone': self.phone,
            'mobile': self.mobile,
            'address': self.address,
            'postal_code': self.postal_code,
            'city': self.city,
            'country': self.country,
            'allergies': self.allergies,
            'medical_notes': self.medical_notes,
            'insurance_info': self.insurance_info,
            'tags': self.tags,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_visit': self.last_visit.isoformat() if self.last_visit else None,
            'is_active': self.is_active
        }
        
        if include_cases:
            data['case_count'] = self.cases.count()
            data['recent_cases'] = [case.to_dict(summary=True) for case in self.cases.order_by(Conversation.updated_at.desc()).limit(5)]
        
        return data
    
    def __repr__(self):
        return f'<Patient {self.patient_number}: {self.full_name}>'