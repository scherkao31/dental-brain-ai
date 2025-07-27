from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Patient, Conversation
from datetime import datetime
from sqlalchemy import or_

patient_bp = Blueprint('patient', __name__)

@patient_bp.route('/', methods=['GET'])
@login_required
def get_patients():
    """Get all patients for current user"""
    try:
        # Get query parameters
        sort_by = request.args.get('sort_by', 'updated_at')
        is_active = request.args.get('is_active', 'true').lower() == 'true'
        
        # Build query
        query = Patient.query.filter_by(user_id=current_user.id)
        
        if is_active:
            query = query.filter_by(is_active=True)
        
        # Sort
        if sort_by == 'name':
            query = query.order_by(Patient.last_name, Patient.first_name)
        elif sort_by == 'patient_number':
            query = query.order_by(Patient.patient_number)
        elif sort_by == 'created_at':
            query = query.order_by(Patient.created_at.desc())
        else:  # updated_at
            query = query.order_by(Patient.updated_at.desc())
        
        patients = query.all()
        
        # Get case counts for each patient
        patient_data = []
        for patient in patients:
            data = patient.to_dict()
            data['case_count'] = Conversation.query.filter_by(
                patient_id=patient.id,
                user_id=current_user.id,
                is_active=True
            ).count()
            patient_data.append(data)
        
        return jsonify({
            'status': 'success',
            'patients': patient_data
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patient_bp.route('/<int:patient_id>', methods=['GET'])
@login_required
def get_patient(patient_id):
    """Get a specific patient with recent cases"""
    try:
        patient = Patient.query.filter_by(
            id=patient_id,
            user_id=current_user.id
        ).first()
        
        if not patient:
            return jsonify({
                'status': 'error',
                'message': 'Patient non trouvé'
            }), 404
        
        # Get patient data
        patient_data = patient.to_dict()
        
        # Get recent cases
        recent_cases = Conversation.query.filter_by(
            patient_id=patient.id,
            user_id=current_user.id,
            is_active=True
        ).order_by(Conversation.updated_at.desc()).limit(5).all()
        
        patient_data['recent_cases'] = [
            {
                'id': case.id,
                'title': case.title,
                'case_type': case.case_type,
                'has_treatment_plan': case.has_treatment_plan,
                'treatment_plan_approved': case.treatment_plan_approved,
                'status': case.status,
                'created_at': case.created_at.isoformat() if case.created_at else None,
                'updated_at': case.updated_at.isoformat() if case.updated_at else None
            }
            for case in recent_cases
        ]
        
        return jsonify({
            'status': 'success',
            'patient': patient_data
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patient_bp.route('/', methods=['POST'])
@login_required
def create_patient():
    """Create a new patient"""
    try:
        data = request.json
        
        # Validate required fields - only patient_number is required
        if not data.get('patient_number'):
            return jsonify({
                'status': 'error',
                'message': 'Le numéro patient est requis'
            }), 400
        
        # Check if patient number already exists for this user
        existing = Patient.query.filter_by(
            user_id=current_user.id,
            patient_number=data['patient_number']
        ).first()
        
        if existing:
            return jsonify({
                'status': 'error',
                'message': 'Ce numéro patient existe déjà'
            }), 409
        
        # Create patient - use patient number as name if no name provided
        patient = Patient(
            user_id=current_user.id,
            patient_number=data['patient_number'],
            first_name=data.get('first_name') or '',
            last_name=data.get('last_name') or data['patient_number'],  # Use patient number as last name if none provided
            date_of_birth=datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date() if data.get('date_of_birth') else None,
            gender=data.get('gender'),
            email=data.get('email'),
            phone=data.get('phone'),
            mobile=data.get('mobile'),
            address=data.get('address'),
            postal_code=data.get('postal_code'),
            city=data.get('city'),
            country=data.get('country', 'Suisse'),
            allergies=data.get('allergies'),
            medical_notes=data.get('medical_notes'),
            tags=data.get('tags', []),
            is_active=True
        )
        
        db.session.add(patient)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'patient': patient.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patient_bp.route('/<int:patient_id>', methods=['PUT'])
@login_required
def update_patient(patient_id):
    """Update a patient"""
    try:
        patient = Patient.query.filter_by(
            id=patient_id,
            user_id=current_user.id
        ).first()
        
        if not patient:
            return jsonify({
                'status': 'error',
                'message': 'Patient non trouvé'
            }), 404
        
        data = request.json
        
        # Update fields
        if 'patient_number' in data:
            # Check if new number is already used
            existing = Patient.query.filter(
                Patient.user_id == current_user.id,
                Patient.patient_number == data['patient_number'],
                Patient.id != patient_id
            ).first()
            
            if existing:
                return jsonify({
                    'status': 'error',
                    'message': 'Ce numéro patient existe déjà'
                }), 409
            
            patient.patient_number = data['patient_number']
        
        if 'first_name' in data:
            patient.first_name = data['first_name']
        if 'last_name' in data:
            patient.last_name = data['last_name']
        if 'date_of_birth' in data:
            patient.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date() if data['date_of_birth'] else None
        if 'gender' in data:
            patient.gender = data['gender'] or None
        if 'email' in data:
            patient.email = data['email'] or None
        if 'phone' in data:
            patient.phone = data['phone'] or None
        if 'mobile' in data:
            patient.mobile = data['mobile'] or None
        if 'address' in data:
            patient.address = data['address'] or None
        if 'postal_code' in data:
            patient.postal_code = data['postal_code'] or None
        if 'city' in data:
            patient.city = data['city'] or None
        if 'country' in data:
            patient.country = data['country'] or 'Suisse'
        if 'allergies' in data:
            patient.allergies = data['allergies'] or None
        if 'medical_notes' in data:
            patient.medical_notes = data['medical_notes'] or None
        if 'tags' in data:
            patient.tags = data['tags']
        if 'is_active' in data:
            patient.is_active = data['is_active']
        
        patient.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'patient': patient.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patient_bp.route('/<int:patient_id>', methods=['DELETE'])
@login_required
def delete_patient(patient_id):
    """Soft delete a patient"""
    try:
        patient = Patient.query.filter_by(
            id=patient_id,
            user_id=current_user.id
        ).first()
        
        if not patient:
            return jsonify({
                'status': 'error',
                'message': 'Patient non trouvé'
            }), 404
        
        # Soft delete
        patient.is_active = False
        patient.updated_at = datetime.utcnow()
        
        # Also deactivate all associated conversations
        Conversation.query.filter_by(patient_id=patient_id).update({
            'is_active': False,
            'updated_at': datetime.utcnow()
        })
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Patient archivé avec succès'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patient_bp.route('/search', methods=['GET'])
@login_required
def search_patients():
    """Search patients"""
    try:
        query = request.args.get('q', '').strip()
        
        if not query:
            return jsonify({
                'status': 'success',
                'patients': []
            })
        
        # Search in multiple fields
        patients = Patient.query.filter(
            Patient.user_id == current_user.id,
            Patient.is_active == True,
            or_(
                Patient.patient_number.ilike(f'%{query}%'),
                Patient.first_name.ilike(f'%{query}%'),
                Patient.last_name.ilike(f'%{query}%'),
                Patient.email.ilike(f'%{query}%'),
                Patient.phone.ilike(f'%{query}%'),
                Patient.mobile.ilike(f'%{query}%')
            )
        ).limit(10).all()
        
        return jsonify({
            'status': 'success',
            'patients': [p.to_dict() for p in patients]
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patient_bp.route('/tags', methods=['GET'])
@login_required
def get_all_tags():
    """Get all unique tags used across patients"""
    try:
        # Get all patients for the user
        patients = Patient.query.filter_by(
            user_id=current_user.id,
            is_active=True
        ).all()
        
        # Collect all unique tags
        all_tags = set()
        for patient in patients:
            if patient.tags:
                all_tags.update(patient.tags)
        
        return jsonify({
            'status': 'success',
            'tags': sorted(list(all_tags))
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patient_bp.route('/generate-number', methods=['GET'])
@login_required
def generate_patient_number():
    """Generate a unique patient number"""
    try:
        # Get all existing patient numbers for this user
        existing_numbers = db.session.query(Patient.patient_number).filter_by(
            user_id=current_user.id
        ).all()
        
        existing_set = {num[0] for num in existing_numbers}
        
        # Try different formats until we find a unique one
        year = datetime.now().year
        
        # First try sequential numbering
        for i in range(1, 10000):
            candidate = f"P{year}{i:04d}"
            if candidate not in existing_set:
                return jsonify({
                    'status': 'success',
                    'patient_number': candidate
                })
        
        # If that fails, use random numbers
        import random
        for _ in range(100):
            random_num = random.randint(10000, 99999)
            candidate = f"P{year}{random_num}"
            if candidate not in existing_set:
                return jsonify({
                    'status': 'success',
                    'patient_number': candidate
                })
        
        # Ultimate fallback
        return jsonify({
            'status': 'success',
            'patient_number': f"P{year}{datetime.now().timestamp():.0f}"[-10:]
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500