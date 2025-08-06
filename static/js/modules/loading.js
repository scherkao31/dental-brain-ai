// Loading States Module
// Handles loading indicators and error states

import { appState } from './state.js';
import { DOMUtils } from './dom-utils.js';

class LoadingManager {
    constructor() {
        this.activeLoaders = new Map();
        this.init();
    }
    
    init() {
        // Create global loading overlay if needed
        if (!document.getElementById('global-loading')) {
            const overlay = DOMUtils.createElement('div', {
                className: 'global-loading-overlay',
                attributes: { id: 'global-loading' },
                innerHTML: `
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Chargement...</p>
                    </div>
                `
            });
            document.body.appendChild(overlay);
        }
        
        // Subscribe to loading state changes
        appState.subscribe((property) => {
            if (property === 'isLoading') {
                this.updateGlobalLoading(appState.isLoading);
            }
        });
    }
    
    // Show loading state for a specific element
    showElementLoading(elementId, message = 'Chargement...') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Save original content
        this.activeLoaders.set(elementId, {
            originalContent: element.innerHTML,
            element: element
        });
        
        // Add loading class and content
        element.classList.add('loading');
        element.innerHTML = `
            <div class="element-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>${message}</span>
            </div>
        `;
    }
    
    // Hide loading state for a specific element
    hideElementLoading(elementId) {
        const loaderInfo = this.activeLoaders.get(elementId);
        if (!loaderInfo) return;
        
        const { element, originalContent } = loaderInfo;
        element.classList.remove('loading');
        element.innerHTML = originalContent;
        
        this.activeLoaders.delete(elementId);
    }
    
    // Show loading overlay on a container
    showContainerLoading(containerId, message = 'Chargement...') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Create overlay for this container
        const overlay = DOMUtils.createElement('div', {
            className: 'container-loading-overlay',
            attributes: { 
                id: `${containerId}-loading`,
                'data-container': containerId
            },
            innerHTML: `
                <div class="loading-content">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>${message}</p>
                </div>
            `
        });
        
        // Position relative to container
        container.style.position = 'relative';
        container.appendChild(overlay);
    }
    
    // Hide loading overlay from a container
    hideContainerLoading(containerId) {
        const overlay = document.getElementById(`${containerId}-loading`);
        if (overlay) {
            overlay.remove();
        }
    }
    
    // Update global loading state
    updateGlobalLoading(isLoading) {
        const overlay = document.getElementById('global-loading');
        if (overlay) {
            if (isLoading) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }
    }
    
    // Show skeleton loader for content
    showSkeletonLoader(containerId, count = 3) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Save original content
        this.activeLoaders.set(containerId, {
            originalContent: container.innerHTML,
            element: container
        });
        
        // Create skeleton items
        let skeletonHTML = '<div class="skeleton-loader">';
        for (let i = 0; i < count; i++) {
            skeletonHTML += `
                <div class="skeleton-item">
                    <div class="skeleton-line skeleton-title"></div>
                    <div class="skeleton-line skeleton-text"></div>
                    <div class="skeleton-line skeleton-text short"></div>
                </div>
            `;
        }
        skeletonHTML += '</div>';
        
        container.innerHTML = skeletonHTML;
    }
    
    // Hide skeleton loader
    hideSkeletonLoader(containerId) {
        this.hideElementLoading(containerId);
    }
    
    // Create a loading button
    setButtonLoading(button, isLoading, loadingText = 'Chargement...') {
        if (typeof button === 'string') {
            button = document.getElementById(button);
        }
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
            button.classList.add('loading');
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
            button.classList.remove('loading');
        }
    }
    
    // Show error state in a container
    showError(containerId, error, onRetry = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        let errorHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Une erreur s'est produite</h3>
                <p>${DOMUtils.escapeHtml(error.message || error)}</p>
        `;
        
        if (onRetry) {
            errorHTML += `
                <button class="retry-btn" onclick="loadingManager.retryAction('${containerId}')">
                    <i class="fas fa-redo"></i> Réessayer
                </button>
            `;
            // Store retry function
            this.activeLoaders.set(`${containerId}-retry`, onRetry);
        }
        
        errorHTML += '</div>';
        container.innerHTML = errorHTML;
    }
    
    // Retry action for error state
    retryAction(containerId) {
        const retryFn = this.activeLoaders.get(`${containerId}-retry`);
        if (retryFn && typeof retryFn === 'function') {
            retryFn();
            this.activeLoaders.delete(`${containerId}-retry`);
        }
    }
    
    // Show empty state
    showEmptyState(containerId, message = 'Aucune donnée disponible', icon = 'fa-inbox') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas ${icon}"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// Add required CSS
const style = document.createElement('style');
style.textContent = `
    /* Global loading overlay */
    .global-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s;
    }
    
    .global-loading-overlay.active {
        opacity: 1;
        visibility: visible;
    }
    
    .loading-spinner {
        text-align: center;
        color: white;
    }
    
    .loading-spinner i {
        font-size: 48px;
        margin-bottom: 16px;
    }
    
    /* Container loading overlay */
    .container-loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
    }
    
    .loading-content {
        text-align: center;
        color: white;
    }
    
    /* Element loading */
    .element-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 20px;
        color: var(--text-secondary, #666);
    }
    
    /* Skeleton loader */
    .skeleton-loader {
        padding: 20px 0;
    }
    
    .skeleton-item {
        margin-bottom: 20px;
        animation: skeleton-pulse 1.5s ease-in-out infinite;
    }
    
    .skeleton-line {
        height: 12px;
        background: var(--bg-secondary, #333);
        border-radius: 4px;
        margin-bottom: 8px;
    }
    
    .skeleton-title {
        width: 60%;
        height: 16px;
    }
    
    .skeleton-text {
        width: 100%;
    }
    
    .skeleton-text.short {
        width: 75%;
    }
    
    @keyframes skeleton-pulse {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0.4;
        }
        100% {
            opacity: 1;
        }
    }
    
    /* Error state */
    .error-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-secondary, #666);
    }
    
    .error-state i {
        font-size: 48px;
        color: #ef4444;
        margin-bottom: 16px;
    }
    
    .error-state h3 {
        margin: 16px 0 8px;
        color: var(--text-primary, #fff);
    }
    
    .retry-btn {
        margin-top: 16px;
        padding: 10px 20px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
    }
    
    .retry-btn:hover {
        background: #2563eb;
    }
    
    /* Empty state */
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-secondary, #666);
    }
    
    .empty-state i {
        font-size: 64px;
        opacity: 0.3;
        margin-bottom: 16px;
    }
    
    /* Loading button */
    button.loading {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
        .loading-spinner i,
        .error-state i {
            font-size: 36px;
        }
        
        .empty-state i {
            font-size: 48px;
        }
    }
`;
document.head.appendChild(style);

// Export singleton instance
export const loadingManager = new LoadingManager();

// Make it globally available
window.loadingManager = loadingManager;