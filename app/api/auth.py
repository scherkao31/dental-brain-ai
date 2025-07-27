from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models import User
from datetime import datetime

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Register a new user"""
    try:
        data = request.json
        email = data.get('email', '').lower().strip()
        username = data.get('username', '').strip()
        password = data.get('password')
        full_name = data.get('full_name', '').strip()
        
        # Validation
        if not email or not username or not password:
            return jsonify({
                'status': 'error',
                'message': 'Email, nom d\'utilisateur et mot de passe requis'
            }), 400
        
        if len(password) < 6:
            return jsonify({
                'status': 'error',
                'message': 'Le mot de passe doit contenir au moins 6 caractères'
            }), 400
        
        # Check if user exists
        if User.query.filter_by(email=email).first():
            return jsonify({
                'status': 'error',
                'message': 'Un compte existe déjà avec cet email'
            }), 409
        
        if User.query.filter_by(username=username).first():
            return jsonify({
                'status': 'error',
                'message': 'Ce nom d\'utilisateur est déjà pris'
            }), 409
        
        # Create new user
        user = User(
            email=email,
            username=username,
            full_name=full_name
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # Log the user in
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Login page and login handler"""
    if request.method == 'GET':
        # Serve the login page
        from flask import render_template, redirect, url_for
        from flask_login import current_user
        if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
            return redirect(url_for('main.index'))
        return render_template('login.html')
    
    # POST method - Login an existing user
    try:
        data = request.json
        email_or_username = data.get('email_or_username', '').strip()
        password = data.get('password')
        remember = data.get('remember', True)
        
        if not email_or_username or not password:
            return jsonify({
                'status': 'error',
                'message': 'Email/nom d\'utilisateur et mot de passe requis'
            }), 400
        
        # Find user by email or username
        user = User.query.filter(
            (User.email == email_or_username.lower()) | 
            (User.username == email_or_username)
        ).first()
        
        if not user or not user.check_password(password):
            return jsonify({
                'status': 'error',
                'message': 'Email/nom d\'utilisateur ou mot de passe incorrect'
            }), 401
        
        if not user.is_active:
            return jsonify({
                'status': 'error',
                'message': 'Ce compte a été désactivé'
            }), 403
        
        # Log the user in
        login_user(user, remember=remember)
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'user': user.to_dict()
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Logout the current user"""
    logout_user()
    return jsonify({
        'status': 'success',
        'message': 'Déconnexion réussie'
    })

@auth_bp.route('/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated"""
    if current_user.is_authenticated:
        return jsonify({
            'status': 'success',
            'authenticated': True,
            'user': current_user.to_dict()
        })
    else:
        return jsonify({
            'status': 'success',
            'authenticated': False
        })