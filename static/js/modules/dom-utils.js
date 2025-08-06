// DOM Utilities Module
// Helper functions for DOM manipulation and HTML generation

export const DOMUtils = {
    // Safely escape HTML to prevent XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Create element with classes and attributes
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.innerHTML) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.textContent) {
            element.textContent = options.textContent;
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        if (options.events) {
            Object.entries(options.events).forEach(([event, handler]) => {
                element.addEventListener(event, handler);
            });
        }
        
        return element;
    },
    
    // Show/hide element with optional fade
    show(element, display = 'block') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.display = display;
        }
    },
    
    hide(element) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.display = 'none';
        }
    },
    
    // Toggle element visibility
    toggle(element, display = 'block') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.display = element.style.display === 'none' ? display : 'none';
        }
    },
    
    // Add loading state to element
    setLoading(element, isLoading) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (!element) return;
        
        if (isLoading) {
            element.classList.add('loading');
            element.disabled = true;
            if (element.tagName === 'BUTTON') {
                element.dataset.originalText = element.innerHTML;
                element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
            }
        } else {
            element.classList.remove('loading');
            element.disabled = false;
            if (element.tagName === 'BUTTON' && element.dataset.originalText) {
                element.innerHTML = element.dataset.originalText;
                delete element.dataset.originalText;
            }
        }
    },
    
    // Smooth scroll to element
    scrollToElement(element, behavior = 'smooth') {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.scrollIntoView({ behavior, block: 'end' });
        }
    },
    
    // Format date relative to now
    formatRelativeDate(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                return diffMinutes <= 1 ? 'À l\'instant' : `Il y a ${diffMinutes} minutes`;
            }
            return diffHours === 1 ? 'Il y a 1 heure' : `Il y a ${diffHours} heures`;
        } else if (diffDays === 1) {
            return 'Hier';
        } else if (diffDays < 30) {
            return `Il y a ${diffDays} jours`;
        } else {
            return date.toLocaleDateString('fr-FR');
        }
    },
    
    // Clean HTML content by removing scripts and dangerous elements
    sanitizeHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove script tags
        temp.querySelectorAll('script').forEach(el => el.remove());
        
        // Remove event handlers
        temp.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        return temp.innerHTML;
    },
    
    // Debounce function for search inputs
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};