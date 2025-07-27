from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Patient, Conversation
from datetime import datetime

patients_bp = Blueprint('patients', __name__)

@patients_bp.route('/', methods=['GET'])
@login_required
def get_patients():
    """Get all patients for the current user"""
    try:
        # Get query parameters
        search = request.args.get('search', '')
        tags = request.args.getlist('tags')
        is_active = request.args.get('is_active', 'true').lower() == 'true'
        sort_by = request.args.get('sort_by', 'updated_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Build query
        query = Patient.query.filter_by(user_id=current_user.id, is_active=is_active)
        
        # Search filter
        if search:
            search_filter = f'%{search}%'
            query = query.filter(
                db.or_(
                    Patient.patient_number.ilike(search_filter),
                    Patient.first_name.ilike(search_filter),
                    Patient.last_name.ilike(search_filter),
                    Patient.email.ilike(search_filter),
                    Patient.phone.ilike(search_filter),
                    Patient.mobile.ilike(search_filter)
                )
            )
        
        # Tag filter
        if tags:
            for tag in tags:
                query = query.filter(Patient.tags.contains([tag]))
        
        # Sorting
        if sort_by == 'name':
            order = Patient.last_name.asc() if sort_order == 'asc' else Patient.last_name.desc()
        elif sort_by == 'patient_number':
            order = Patient.patient_number.asc() if sort_order == 'asc' else Patient.patient_number.desc()
        elif sort_by == 'created_at':
            order = Patient.created_at.asc() if sort_order == 'asc' else Patient.created_at.desc()
        else:  # updated_at
            order = Patient.updated_at.asc() if sort_order == 'asc' else Patient.updated_at.desc()
        
        patients = query.order_by(order).all()
        
        return jsonify({
            'status': 'success',
            'patients': [patient.to_dict(include_cases=True) for patient in patients],
            'total': len(patients)
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patients_bp.route('/', methods=['POST'])
@login_required
def create_patient():
    """Create a new patient"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['patient_number', 'first_name', 'last_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'status': 'error',
                    'message': f'{field} est requis'
                }), 400
        
        # Check if patient number already exists for this user
        existing = Patient.query.filter_by(
            user_id=current_user.id,
            patient_number=data['patient_number']
        ).first()
        
        if existing:
            return jsonify({
                'status': 'error',
                'message': 'Ce numéro de patient existe déjà'
            }), 400
        
        # Create patient
        patient = Patient(
            user_id=current_user.id,
            patient_number=data['patient_number'],
            first_name=data['first_name'],
            last_name=data['last_name'],
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
            insurance_info=data.get('insurance_info', {}),
            tags=data.get('tags', [])
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

@patients_bp.route('/<int:patient_id>', methods=['GET'])
@login_required
def get_patient(patient_id):
    """Get a specific patient"""
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
        
        return jsonify({
            'status': 'success',
            'patient': patient.to_dict(include_cases=True)
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patients_bp.route('/<int:patient_id>', methods=['PUT'])
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
        if 'first_name' in data:
            patient.first_name = data['first_name']
        if 'last_name' in data:
            patient.last_name = data['last_name']
        if 'date_of_birth' in data:
            patient.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date() if data['date_of_birth'] else None
        if 'gender' in data:
            patient.gender = data['gender']
        if 'email' in data:
            patient.email = data['email']
        if 'phone' in data:
            patient.phone = data['phone']
        if 'mobile' in data:
            patient.mobile = data['mobile']
        if 'address' in data:
            patient.address = data['address']
        if 'postal_code' in data:
            patient.postal_code = data['postal_code']
        if 'city' in data:
            patient.city = data['city']
        if 'country' in data:
            patient.country = data['country']
        if 'allergies' in data:
            patient.allergies = data['allergies']
        if 'medical_notes' in data:
            patient.medical_notes = data['medical_notes']
        if 'insurance_info' in data:
            patient.insurance_info = data['insurance_info']
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

@patients_bp.route('/<int:patient_id>', methods=['DELETE'])
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

@patients_bp.route('/<int:patient_id>/cases', methods=['GET'])
@login_required
def get_patient_cases(patient_id):
    """Get all cases for a specific patient"""
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
        
        cases = patient.cases.order_by(Conversation.updated_at.desc()).all()
        
        return jsonify({
            'status': 'success',
            'cases': [case.to_dict(include_patient=False) for case in cases],
            'total': len(cases)
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@patients_bp.route('/search', methods=['GET'])
@login_required
def search_patients():
    """Quick search for patient selection"""
    try:
        query = request.args.get('q', '')
        limit = int(request.args.get('limit', 10))
        
        if not query or len(query) < 2:
            return jsonify({
                'status': 'success',
                'patients': []
            })
        
        search_filter = f'%{query}%'
        patients = Patient.query.filter_by(
            user_id=current_user.id,
            is_active=True
        ).filter(
            db.or_(
                Patient.patient_number.ilike(search_filter),
                Patient.first_name.ilike(search_filter),
                Patient.last_name.ilike(search_filter)
            )
        ).limit(limit).all()
        
        return jsonify({
            'status': 'success',
            'patients': [{
                'id': p.id,
                'patient_number': p.patient_number,
                'display_name': p.display_name,
                'email': p.email,
                'phone': p.phone or p.mobile
            } for p in patients]
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500