// Notification Module
// Handles all toast notifications with proper styling and animations

class NotificationManager {
    constructor() {
        this.container = null;
        this.init();
    }
    
    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            `;
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }
    
    show(type, message, duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        notification.innerHTML = `
            <i class="fas ${icons[type]}" style="color: ${colors[type]}; margin-right: 10px;"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="notification-close" style="margin-left: auto; background: none; border: none; color: currentColor; cursor: pointer; padding: 0 0 0 10px;">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        notification.style.cssText = `
            display: flex;
            align-items: center;
            padding: 16px 20px;
            background: var(--bg-secondary, #1a1a1a);
            border: 1px solid ${colors[type]}33;
            border-left: 4px solid ${colors[type]};
            border-radius: 8px;
            color: var(--text-primary, #fff);
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideIn 0.3s ease;
            width: 100%;
            min-width: 300px;
        `;
        
        // Add close functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.onclick = () => this.remove(notification);
        
        // Add to container
        this.container.appendChild(notification);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => this.remove(notification), duration);
        }
        
        return notification;
    }
    
    remove(notification) {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }
    
    success(message, duration) {
        return this.show('success', message, duration);
    }
    
    error(message, duration) {
        return this.show('error', message, duration);
    }
    
    warning(message, duration) {
        return this.show('warning', message, duration);
    }
    
    info(message, duration) {
        return this.show('info', message, duration);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Add required CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification {
        transition: all 0.3s ease;
    }
    
    .notification:hover {
        transform: translateX(-5px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }
    
    @media (max-width: 768px) {
        #notification-container {
            left: 10px;
            right: 10px;
            max-width: none;
        }
        
        .notification {
            font-size: 13px;
            padding: 12px 16px;
        }
    }
`;
document.head.appendChild(style);

// Export singleton instance
export const notifications = new NotificationManager();