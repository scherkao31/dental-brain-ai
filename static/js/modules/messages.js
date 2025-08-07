// Messages Module
// Handles chat messages display and sending

import { apiClient } from './api-client.js';
import { appState } from './state.js';
import { DOMUtils } from './dom-utils.js';
import { notifications } from './notifications.js';

class MessageManager {
    constructor() {
        this.messagesContainer = null;
        this.chatInput = null;
        this.sendButton = null;
        this.typingTimeout = null;
        this.messageHistory = [];
        this.init();
    }
    
    init() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendBtn');
        
        // Set up event listeners
        if (this.chatInput) {
            this.chatInput.addEventListener('keydown', (e) => this.handleInputKeydown(e));
            this.chatInput.addEventListener('input', (e) => this.autoResizeTextarea(e.target));
        }
        
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendMessage());
        }
    }
    
    clearMessages() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
            this.messageHistory = [];
        }
    }
    
    showWelcomeMessage() {
        if (!this.messagesContainer) return;
        
        this.messagesContainer.innerHTML = `
            <div class="welcome-message" id="welcomeMessage">
                <div class="welcome-icon">
                    <i class="fas fa-brain"></i>
                </div>
                <h3>Bienvenue dans Dental Brain AI</h3>
                <p>Je suis votre assistant spécialisé en planification de traitements dentaires.</p>
                <div class="suggestions">
                    <p>Essayez ces exemples:</p>
                    <button class="suggestion-chip" onclick="messageManager.sendSuggestion('Plan de TT 12 à 22 F')">
                        Plan de TT 12 à 22 F
                    </button>
                    <button class="suggestion-chip" onclick="messageManager.sendSuggestion('Traitement de racine 3 canaux')">
                        Traitement de racine 3 canaux
                    </button>
                    <button class="suggestion-chip" onclick="messageManager.sendSuggestion('26 CC')">
                        26 CC (Couronne céramique)
                    </button>
                </div>
            </div>
        `;
    }
    
    displayMessages(messages) {
        this.clearMessages();
        DOMUtils.hide('welcomeMessage');
        
        // Build message history for context
        this.messageHistory = messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
        
        // Display each message
        messages.forEach(msg => {
            this.addMessageToUI(msg.role, msg.content, msg.metadata);
        });
        
        this.scrollToBottom();
    }
    
    addMessageToUI(role, content, metadata = null) {
        const messageDiv = DOMUtils.createElement('div', {
            className: `message ${role}`
        });
        
        const wrapperDiv = DOMUtils.createElement('div', {
            className: 'message-wrapper'
        });
        
        // Avatar
        const avatarDiv = DOMUtils.createElement('div', {
            className: 'message-avatar',
            innerHTML: role === 'user' ? 
                '<i class="fas fa-user"></i>' : 
                '<i class="fas fa-brain"></i>'
        });
        
        // Content wrapper
        const contentWrapper = DOMUtils.createElement('div', {
            className: 'message-content-wrapper'
        });
        
        // Handle assistant messages with tabs
        if (role === 'assistant' && metadata) {
            contentWrapper.innerHTML = this.createTabbedOutput(content, metadata);
        } else {
            contentWrapper.innerHTML = `<div class="message-content">${this.formatContent(content)}</div>`;
        }
        
        // Store metadata
        if (metadata) {
            messageDiv.dataset.metadata = JSON.stringify(metadata);
        }
        
        // Assemble message
        wrapperDiv.appendChild(avatarDiv);
        wrapperDiv.appendChild(contentWrapper);
        messageDiv.appendChild(wrapperDiv);
        
        // Add timestamp
        const timestamp = DOMUtils.createElement('div', {
            className: 'message-time',
            textContent: new Date().toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        });
        messageDiv.appendChild(timestamp);
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    createTabbedOutput(content, metadata) {
        const hasReferences = metadata.references && metadata.references.length > 0;
        const hasTreatmentPlan = metadata.treatment_plan;
        
        if (!hasReferences && !hasTreatmentPlan) {
            return `<div class="message-content">${this.formatContent(content)}</div>`;
        }
        
        const messageId = `msg-${Date.now()}`;
        let html = '<div class="tabbed-message">';
        
        // Tab headers
        html += '<div class="message-tabs">';
        html += `<button class="message-tab active" onclick="messageManager.switchTab('${messageId}', 'response')">
            <i class="fas fa-comment-medical"></i> Réponse
        </button>`;
        
        if (hasTreatmentPlan) {
            html += `<button class="message-tab" onclick="messageManager.switchTab('${messageId}', 'treatment')">
                <i class="fas fa-clipboard-list"></i> Plan TT
            </button>`;
        }
        
        if (hasReferences) {
            html += `<button class="message-tab" onclick="messageManager.switchTab('${messageId}', 'references')">
                <i class="fas fa-book-medical"></i> Références (${metadata.references.length})
            </button>`;
        }
        
        html += '</div>';
        
        // Tab contents
        html += '<div class="tab-contents">';
        
        // Response tab
        html += `<div class="tab-content active" data-tab="response">
            <div class="message-content">${this.formatContent(content)}</div>
        </div>`;
        
        // Treatment plan tab
        if (hasTreatmentPlan) {
            html += `<div class="tab-content" data-tab="treatment">
                ${this.formatTreatmentPlanForTab(metadata.treatment_plan)}
            </div>`;
        }
        
        // References tab
        if (hasReferences) {
            html += `<div class="tab-content" data-tab="references">
                ${this.formatReferencesForTab(metadata.references)}
            </div>`;
        }
        
        html += '</div></div>';
        
        return html;
    }
    
    formatContent(content) {
        // Convert markdown-style formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }
    
    formatTreatmentPlanForTab(plan) {
        if (!plan || !plan.treatment_sequence) {
            return '<p class="no-data">Aucun plan de traitement disponible</p>';
        }
        
        let html = '<div class="treatment-preview">';
        html += '<table class="treatment-table-preview">';
        html += '<thead><tr><th>RDV</th><th>Traitement</th><th>Durée</th><th>Délai</th></tr></thead>';
        html += '<tbody>';
        
        plan.treatment_sequence.forEach((step, index) => {
            html += `<tr>
                <td>${step.rdv || index + 1}</td>
                <td>${DOMUtils.escapeHtml(step.traitement)}</td>
                <td>${step.duree || '-'}</td>
                <td>${step.delai || '-'}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        
        if (plan.consultation_text) {
            html += `<div class="consultation-preview">${DOMUtils.escapeHtml(plan.consultation_text)}</div>`;
        }
        
        html += '</div>';
        return html;
    }
    
    formatReferencesForTab(references) {
        if (!references || references.length === 0) {
            return '<p class="no-data">Aucune référence disponible</p>';
        }
        
        let html = '<div class="references-list">';
        
        references.forEach(ref => {
            html += this.createReferenceItem(ref);
        });
        
        html += '</div>';
        return html;
    }
    
    createReferenceItem(ref) {
        const typeIcons = {
            'clinical_case': '🏥',
            'ideal_sequence': '📋',
            'knowledge': '📚',
            'approved_sequence': '✅',
            'general_knowledge': '📚'
        };
        
        return `
            <div class="rag-source-item clickable" onclick="messageManager.showReferenceDetail('${ref.id}')">
                <div class="rag-source-header">
                    <span class="rag-source-type">${typeIcons[ref.type] || '📄'}</span>
                    <span class="rag-source-title">${DOMUtils.escapeHtml(ref.title)}</span>
                </div>
                ${ref.similarity_score ? `
                    <div class="rag-source-score">
                        <span class="score-label">Similarité:</span>
                        <div class="score-bar-container">
                            <div class="score-bar score-${this.getScoreClass(ref.similarity_score)}" 
                                 style="width: ${ref.similarity_score}%"></div>
                        </div>
                        <span class="score-percentage">${ref.similarity_score}%</span>
                    </div>
                ` : ''}
                <div class="rag-source-meta">
                    <span class="source-type">${this.getSourceTypeLabel(ref.type)}</span>
                    ${ref.categories?.length > 0 ? 
                        `<span class="source-categories">${ref.categories.join(', ')}</span>` : ''
                    }
                </div>
            </div>
        `;
    }
    
    getScoreClass(score) {
        if (score >= 80) return 'high';
        if (score >= 60) return 'medium';
        return 'low';
    }
    
    getSourceTypeLabel(type) {
        const labels = {
            'clinical_case': 'Cas clinique',
            'ideal_sequence': 'Séquence idéale',
            'knowledge': 'Base de connaissances',
            'approved_sequence': 'Séquence approuvée',
            'general_knowledge': 'Base de connaissances'
        };
        return labels[type] || type;
    }
    
    switchTab(messageId, tabName) {
        const container = this.messagesContainer.querySelector(`#${messageId}`);
        if (!container) return;
        
        // Update active tab
        container.querySelectorAll('.message-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        container.querySelector(`[onclick*="${tabName}"]`).classList.add('active');
        
        // Update active content
        container.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        container.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }
    
    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || appState.isLoading) return;
        
        try {
            // Add user message to UI
            this.addMessageToUI('user', message);
            DOMUtils.hide('welcomeMessage');
            
            // Clear input
            this.chatInput.value = '';
            this.autoResizeTextarea(this.chatInput);
            
            // Show typing indicator
            this.showTypingIndicator();
            
            // Disable input
            DOMUtils.setLoading(this.sendButton, true);
            this.chatInput.disabled = true;
            
            // Send to API
            const result = await apiClient.sendMessage(
                message,
                appState.currentConversationId,
                this.messageHistory
            );
            
            if (result.status === 'success') {
                // Update conversation ID if new
                if (result.conversation_id && !appState.currentConversationId) {
                    appState.setState({ currentConversationId: result.conversation_id });
                    
                    // Reload conversations
                    if (window.conversationManager) {
                        await window.conversationManager.loadConversations();
                    }
                }
                
                // Add to history
                this.messageHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: result.response }
                );
                
                // Add assistant response
                this.hideTypingIndicator();
                // Ensure metadata includes references if they exist
                const metadata = result.metadata || {};
                if (result.references && result.references.length > 0) {
                    metadata.references = result.references;
                }
                this.addMessageToUI('assistant', result.response, metadata);
                
                // Update treatment plan if present
                if (result.metadata?.treatment_plan) {
                    appState.setState({ currentTreatmentPlan: result.metadata.treatment_plan });
                }
            } else {
                throw new Error(result.message || 'Erreur lors de l\'envoi du message');
            }
        } catch (error) {
            console.error('Send message error:', error);
            this.hideTypingIndicator();
            notifications.error(error.message || 'Erreur lors de l\'envoi du message');
        } finally {
            // Re-enable input
            DOMUtils.setLoading(this.sendButton, false);
            this.chatInput.disabled = false;
            this.chatInput.focus();
        }
    }
    
    sendSuggestion(text) {
        this.chatInput.value = text;
        this.autoResizeTextarea(this.chatInput);
        this.sendMessage();
    }
    
    async sendQuickAction(action) {
        const prompts = {
            'suggest-plan': 'Suggère un plan de traitement',
            'generate-note': 'Génère une note clinique pour la consultation',
            'clinical-tips': 'Donne des conseils cliniques pour ce cas'
        };
        
        const prompt = prompts[action];
        if (prompt) {
            this.chatInput.value = prompt;
            this.autoResizeTextarea(this.chatInput);
            await this.sendMessage();
        }
    }
    
    showTypingIndicator() {
        const indicator = DOMUtils.createElement('div', {
            className: 'message assistant typing-indicator',
            innerHTML: `
                <div class="message-wrapper">
                    <div class="message-avatar"><i class="fas fa-brain"></i></div>
                    <div class="message-content">
                        <div class="typing-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            `
        });
        
        this.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const indicator = this.messagesContainer.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    async showReferenceDetail(referenceId) {
        try {
            const result = await apiClient.getReference(referenceId);
            
            if (result.status === 'success') {
                // Show in modal (handled by modal manager)
                if (window.modalManager) {
                    window.modalManager.showReferenceModal(result.reference);
                }
            }
        } catch (error) {
            console.error('Failed to load reference:', error);
            notifications.error('Erreur lors du chargement de la référence');
        }
    }
    
    handleInputKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }
    
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
    
    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }
}

// Export singleton instance
export const messageManager = new MessageManager();

// Make it globally available for onclick handlers
window.messageManager = messageManager;