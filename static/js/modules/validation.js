// Validation Module
// Handles input validation and security measures

export const ValidationRules = {
    // Common validation patterns
    patterns: {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^[\d\s\-\+\(\)]+$/,
        patientNumber: /^[A-Z0-9\-]+$/i,
        postalCode: /^\d{4,5}$/,
        toothNumber: /^[1-4][1-8]$/,
        amount: /^\d+(\.\d{1,2})?$/,
        percentage: /^(100|[1-9]?\d)$/,
        date: /^\d{4}-\d{2}-\d{2}$/
    },
    
    // Validate email
    email(value) {
        if (!value) return { valid: false, error: 'Email requis' };
        if (!this.patterns.email.test(value)) {
            return { valid: false, error: 'Format email invalide' };
        }
        return { valid: true };
    },
    
    // Validate phone number
    phone(value) {
        if (!value) return { valid: true }; // Optional
        const cleaned = value.replace(/[\s\-\(\)]/g, '');
        if (cleaned.length < 10 || cleaned.length > 15) {
            return { valid: false, error: 'Numéro de téléphone invalide' };
        }
        return { valid: true };
    },
    
    // Validate patient number
    patientNumber(value) {
        if (!value) return { valid: false, error: 'Numéro patient requis' };
        if (!this.patterns.patientNumber.test(value)) {
            return { valid: false, error: 'Format invalide (lettres et chiffres uniquement)' };
        }
        return { valid: true };
    },
    
    // Validate tooth number (FDI notation)
    toothNumber(value) {
        if (!value) return { valid: true }; // Optional
        if (!this.patterns.toothNumber.test(value)) {
            return { valid: false, error: 'Numéro de dent invalide (11-48)' };
        }
        return { valid: true };
    },
    
    // Validate amount
    amount(value, min = 0, max = null) {
        if (!value && value !== 0) return { valid: false, error: 'Montant requis' };
        if (!this.patterns.amount.test(value)) {
            return { valid: false, error: 'Format de montant invalide' };
        }
        const num = parseFloat(value);
        if (num < min) {
            return { valid: false, error: `Montant minimum: ${min}` };
        }
        if (max !== null && num > max) {
            return { valid: false, error: `Montant maximum: ${max}` };
        }
        return { valid: true };
    },
    
    // Validate percentage
    percentage(value) {
        if (!value && value !== 0) return { valid: true }; // Optional
        if (!this.patterns.percentage.test(value)) {
            return { valid: false, error: 'Pourcentage invalide (0-100)' };
        }
        return { valid: true };
    },
    
    // Validate date
    date(value, minDate = null, maxDate = null) {
        if (!value) return { valid: true }; // Optional
        if (!this.patterns.date.test(value)) {
            return { valid: false, error: 'Format de date invalide (AAAA-MM-JJ)' };
        }
        
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return { valid: false, error: 'Date invalide' };
        }
        
        if (minDate && date < new Date(minDate)) {
            return { valid: false, error: `Date minimale: ${minDate}` };
        }
        
        if (maxDate && date > new Date(maxDate)) {
            return { valid: false, error: `Date maximale: ${maxDate}` };
        }
        
        return { valid: true };
    },
    
    // Validate required field
    required(value, fieldName = 'Ce champ') {
        if (!value || (typeof value === 'string' && !value.trim())) {
            return { valid: false, error: `${fieldName} est requis` };
        }
        return { valid: true };
    },
    
    // Validate minimum length
    minLength(value, min, fieldName = 'Ce champ') {
        if (!value) return { valid: true }; // Use required() for mandatory fields
        if (value.length < min) {
            return { valid: false, error: `${fieldName} doit contenir au moins ${min} caractères` };
        }
        return { valid: true };
    },
    
    // Validate maximum length
    maxLength(value, max, fieldName = 'Ce champ') {
        if (!value) return { valid: true };
        if (value.length > max) {
            return { valid: false, error: `${fieldName} ne peut pas dépasser ${max} caractères` };
        }
        return { valid: true };
    },
    
    // Validate password strength
    password(value) {
        if (!value) return { valid: false, error: 'Mot de passe requis' };
        
        const errors = [];
        if (value.length < 8) errors.push('au moins 8 caractères');
        if (!/[A-Z]/.test(value)) errors.push('une majuscule');
        if (!/[a-z]/.test(value)) errors.push('une minuscule');
        if (!/[0-9]/.test(value)) errors.push('un chiffre');
        
        if (errors.length > 0) {
            return { 
                valid: false, 
                error: `Le mot de passe doit contenir ${errors.join(', ')}` 
            };
        }
        
        return { valid: true };
    }
};

export const SecurityUtils = {
    // Sanitize HTML input to prevent XSS
    sanitizeHTML(input) {
        if (!input) return '';
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },
    
    // Escape special regex characters
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    
    // Validate and clean search input
    cleanSearchInput(input) {
        if (!input) return '';
        
        // Remove potential SQL injection attempts
        let cleaned = input.replace(/[';""\\]/g, '');
        
        // Limit length
        cleaned = cleaned.substring(0, 100);
        
        // Remove multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    },
    
    // Validate file upload
    validateFileUpload(file, options = {}) {
        const {
            maxSize = 10 * 1024 * 1024, // 10MB default
            allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
            allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
        } = options;
        
        // Check file size
        if (file.size > maxSize) {
            return { 
                valid: false, 
                error: `Fichier trop volumineux (max ${Math.round(maxSize / 1024 / 1024)}MB)` 
            };
        }
        
        // Check MIME type
        if (!allowedTypes.includes(file.type)) {
            return { 
                valid: false, 
                error: 'Type de fichier non autorisé' 
            };
        }
        
        // Check extension
        const extension = file.name.toLowerCase().match(/\.[^.]+$/);
        if (!extension || !allowedExtensions.includes(extension[0])) {
            return { 
                valid: false, 
                error: 'Extension de fichier non autorisée' 
            };
        }
        
        return { valid: true };
    },
    
    // Generate CSRF token (would need backend support)
    generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
};

export class FormValidator {
    constructor(formElement) {
        this.form = typeof formElement === 'string' 
            ? document.getElementById(formElement) 
            : formElement;
        this.errors = new Map();
        this.validations = new Map();
    }
    
    // Add validation rule to a field
    addRule(fieldName, validationFn, errorMessage) {
        if (!this.validations.has(fieldName)) {
            this.validations.set(fieldName, []);
        }
        
        this.validations.get(fieldName).push({
            validate: validationFn,
            errorMessage
        });
        
        return this;
    }
    
    // Add common validations
    required(fieldName, message) {
        return this.addRule(
            fieldName, 
            (value) => ValidationRules.required(value).valid,
            message || `${fieldName} est requis`
        );
    }
    
    email(fieldName) {
        return this.addRule(
            fieldName,
            (value) => ValidationRules.email(value).valid,
            'Email invalide'
        );
    }
    
    minLength(fieldName, min) {
        return this.addRule(
            fieldName,
            (value) => ValidationRules.minLength(value, min).valid,
            `Minimum ${min} caractères`
        );
    }
    
    // Validate a single field
    validateField(fieldName) {
        const field = this.form.elements[fieldName];
        if (!field) return true;
        
        const value = field.value;
        const rules = this.validations.get(fieldName) || [];
        
        this.clearFieldError(fieldName);
        
        for (const rule of rules) {
            if (!rule.validate(value)) {
                this.setFieldError(fieldName, rule.errorMessage);
                return false;
            }
        }
        
        return true;
    }
    
    // Validate entire form
    validate() {
        this.clearAllErrors();
        let isValid = true;
        
        for (const [fieldName] of this.validations) {
            if (!this.validateField(fieldName)) {
                isValid = false;
            }
        }
        
        return isValid;
    }
    
    // Set error for a field
    setFieldError(fieldName, errorMessage) {
        this.errors.set(fieldName, errorMessage);
        
        const field = this.form.elements[fieldName];
        if (field) {
            field.classList.add('error');
            
            // Show error message
            let errorElement = field.parentElement.querySelector('.field-error');
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.className = 'field-error';
                field.parentElement.appendChild(errorElement);
            }
            errorElement.textContent = errorMessage;
        }
    }
    
    // Clear error for a field
    clearFieldError(fieldName) {
        this.errors.delete(fieldName);
        
        const field = this.form.elements[fieldName];
        if (field) {
            field.classList.remove('error');
            
            const errorElement = field.parentElement.querySelector('.field-error');
            if (errorElement) {
                errorElement.remove();
            }
        }
    }
    
    // Clear all errors
    clearAllErrors() {
        for (const [fieldName] of this.errors) {
            this.clearFieldError(fieldName);
        }
    }
    
    // Get all errors
    getErrors() {
        return Object.fromEntries(this.errors);
    }
    
    // Enable real-time validation
    enableLiveValidation() {
        this.form.addEventListener('input', (e) => {
            if (this.validations.has(e.target.name)) {
                this.validateField(e.target.name);
            }
        });
        
        this.form.addEventListener('blur', (e) => {
            if (this.validations.has(e.target.name)) {
                this.validateField(e.target.name);
            }
        }, true);
    }
}

// Add required CSS
const style = document.createElement('style');
style.textContent = `
    .field-error {
        color: #ef4444;
        font-size: 12px;
        margin-top: 4px;
        display: block;
    }
    
    input.error,
    textarea.error,
    select.error {
        border-color: #ef4444 !important;
    }
    
    input.error:focus,
    textarea.error:focus,
    select.error:focus {
        outline-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
`;
document.head.appendChild(style);