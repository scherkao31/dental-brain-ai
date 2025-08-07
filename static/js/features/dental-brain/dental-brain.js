/**
 * Dental Brain Chat Feature Module
 * Handles AI-powered dental consultations and chat functionality
 */
class DentalBrainChat {
    constructor(container, apiClient, utils) {
        this.container = container;
        this.api = apiClient || window.apiClient;
        this.utils = utils || window.utils;
        
        this.history = [];
        this.isLoading = false;
        
        // DOM elements
        this.elements = {
            messages: container.querySelector('.chat-messages'),
            input: container.querySelector('.chat-input'),
            sendButton: container.querySelector('.chat-send')
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkWelcomeMessage();
    }

    setupEventListeners() {
        // Send button click
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key to send
        this.elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.elements.input.addEventListener('input', () => {
            this.autoResizeTextarea();
            this.updateSendButton();
        });
        
        // Initial button state
        this.updateSendButton();
    }

    autoResizeTextarea() {
        const textarea = this.elements.input;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    updateSendButton() {
        const hasText = this.elements.input.value.trim().length > 0;
        this.elements.sendButton.disabled = !hasText || this.isLoading;
    }

    checkWelcomeMessage() {
        if (this.elements.messages.children.length === 0) {
            this.showWelcomeMessage();
        }
    }

    showWelcomeMessage() {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <div class="welcome-icon">
                <i class="fas fa-brain"></i>
            </div>
            <h3>Assistant Dentaire IA</h3>
            <p>Je suis votre assistant spécialisé en dentisterie. Posez-moi vos questions sur:</p>
            <ul>
                <li>Diagnostics et traitements dentaires</li>
                <li>Planification de traitements complexes</li>
                <li>Conseils cliniques et meilleures pratiques</li>
                <li>Gestion des cas cliniques</li>
            </ul>
            <p class="welcome-hint">💡 Astuce: Soyez précis dans vos questions pour obtenir des réponses détaillées</p>
        `;
        this.elements.messages.appendChild(welcomeDiv);
    }

    hideWelcomeMessage() {
        const welcome = this.elements.messages.querySelector('.welcome-message');
        if (welcome) {
            welcome.style.opacity = '0';
            setTimeout(() => welcome.remove(), 300);
        }
    }

    async sendMessage() {
        if (this.isLoading) return;
        
        const message = this.elements.input.value.trim();
        if (!message) return;

        // Add visual feedback
        const inputWrapper = this.elements.input.closest('.chat-input-wrapper');
        inputWrapper.classList.add('loading', 'sending');
        
        setTimeout(() => {
            inputWrapper.classList.remove('sending');
        }, 300);

        // Clear input and update UI
        this.elements.input.value = '';
        this.autoResizeTextarea();
        this.updateSendButton();
        this.hideWelcomeMessage();

        // Add user message
        this.addMessage('user', message);

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Send message to API
            const response = await this.api.sendChatMessage(message, this.history, 'dental-brain');
            
            // Debug: Log the response
            console.log('API Response:', response);
            console.log('References:', response.references);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add assistant response
            this.addMessage('assistant', response.response, response.references, response.context_info);
            
            // Check if response contains a treatment plan
            if (response.is_treatment_plan && response.treatment_plan) {
                // Dispatch event for treatment plan display
                const event = new CustomEvent('treatmentPlanGenerated', {
                    detail: response.treatment_plan
                });
                document.dispatchEvent(event);
            }
            
            // Update history
            this.history.push(
                { role: 'user', content: message },
                { role: 'assistant', content: response.response }
            );
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addMessage('assistant', 
                `Désolé, une erreur s'est produite: ${error.message}. Veuillez réessayer.`
            );
        } finally {
            inputWrapper.classList.remove('loading');
        }
    }

    addMessage(role, content, references = null, contextInfo = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        // Add avatar
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? 
            '<i class="fas fa-user"></i>' : 
            '<i class="fas fa-tooth"></i>';
        
        // Add content
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Convert markdown to HTML if assistant message
        if (role === 'assistant') {
            messageContent.innerHTML = this.formatMessage(content);
            
            // Add references if available
            if (references && references.length > 0) {
                const referencesDiv = document.createElement('div');
                referencesDiv.className = 'message-references';
                referencesDiv.innerHTML = '<div class="references-title">📚 Sources:</div>';
                references.forEach(ref => {
                    const refDiv = document.createElement('div');
                    refDiv.className = 'reference-item';
                    const similarity = ref.similarity_score ? ` (${Math.round(ref.similarity_score * 100)}%)` : '';
                    refDiv.innerHTML = `
                        <span class="ref-type">${this.getRefTypeIcon(ref.type)}</span>
                        <span class="ref-title">${ref.title}${similarity}</span>
                    `;
                    referencesDiv.appendChild(refDiv);
                });
                messageContent.appendChild(referencesDiv);
            }
            
            // Add context info if available
            if (contextInfo) {
                const contextDiv = document.createElement('div');
                contextDiv.className = 'message-context';
                contextDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${contextInfo}`;
                messageContent.appendChild(contextDiv);
            }
        } else {
            messageContent.textContent = content;
        }
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Assemble message
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(timestamp);
        
        this.elements.messages.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Animate message appearance
        setTimeout(() => messageDiv.classList.add('visible'), 10);
    }

    formatMessage(content) {
        // Basic markdown to HTML conversion
        let formatted = content
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
            // Inline code
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Lists
            .replace(/^\- (.*?)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            // Line breaks
            .replace(/\n/g, '<br>');
            
        return formatted;
    }

    showTypingIndicator() {
        this.isLoading = true;
        this.updateSendButton();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant typing';
        messageDiv.id = 'typing-indicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-tooth"></i>';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = `
            <div class="loading">
                <span>Réflexion en cours</span>
                <div class="loading-dots">
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                </div>
            </div>
        `;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        this.elements.messages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isLoading = false;
        this.updateSendButton();
        
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    scrollToBottom() {
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }

    // Public method to clear chat
    clearChat() {
        this.elements.messages.innerHTML = '';
        this.history = [];
        this.showWelcomeMessage();
    }

    // Public method to get chat history
    getHistory() {
        return this.history;
    }
    
    // Helper method to get icon for reference type
    getRefTypeIcon(type) {
        const icons = {
            'clinical_case': '📋',
            'ideal_sequence': '📝',
            'general_knowledge': '📚'
        };
        return icons[type] || '📄';
    }
}

// Export for use
window.DentalBrainChat = DentalBrainChat;