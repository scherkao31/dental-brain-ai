// Conversations Module
// Handles all conversation-related functionality

import { apiClient } from './api-client.js';
import { appState } from './state.js';
import { DOMUtils } from './dom-utils.js';
import { notifications } from './notifications.js';

class ConversationManager {
    constructor() {
        this.listElement = null;
        this.init();
    }
    
    init() {
        this.listElement = document.getElementById('conversationsList');
    }
    
    async loadConversations() {
        try {
            const result = await apiClient.getConversations();
            
            if (result.status === 'success') {
                appState.setState({ allConversations: result.conversations });
                this.displayConversations(result.conversations);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
            notifications.error('Erreur lors du chargement des conversations');
        }
    }
    
    displayConversations(conversations) {
        if (!this.listElement) return;
        
        this.listElement.innerHTML = '';
        
        if (conversations.length === 0) {
            this.listElement.innerHTML = `
                <div class="empty-state">
                    <p>Aucune conversation</p>
                    <p class="hint">Commencez une nouvelle conversation</p>
                </div>
            `;
            return;
        }
        
        conversations.forEach(conv => {
            const item = this.createConversationItem(conv);
            this.listElement.appendChild(item);
        });
    }
    
    createConversationItem(conv) {
        const item = DOMUtils.createElement('div', {
            className: `conversation-item ${conv.id === appState.currentConversationId ? 'active' : ''}`,
            attributes: {
                'data-conversation-id': conv.id,
            },
            events: {
                click: () => this.loadConversation(conv.id)
            }
        });
        
        const date = new Date(conv.updated_at);
        const dateStr = DOMUtils.formatRelativeDate(date);
        
        // Build badges HTML
        const badges = this.buildConversationBadges(conv);
        
        item.innerHTML = `
            <div class="conversation-header">
                <div class="conversation-title">${DOMUtils.escapeHtml(conv.title)}</div>
                <div class="conversation-actions">
                    <button class="icon-btn small" onclick="event.stopPropagation(); conversationManager.showRenameDialog(${conv.id}, '${DOMUtils.escapeHtml(conv.title)}')" title="Renommer">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn small danger" onclick="event.stopPropagation(); conversationManager.deleteConversation(${conv.id})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="conversation-info">
                <span class="conversation-date">${dateStr}</span>
                <span class="conversation-messages">${conv.message_count} messages</span>
            </div>
            ${badges ? `<div class="conversation-badges">${badges}</div>` : ''}
        `;
        
        return item;
    }
    
    buildConversationBadges(conv) {
        let badges = '';
        
        
        // Case type badge
        if (conv.case_type) {
            const typeIcons = {
                'treatment_planning': 'fa-clipboard-list',
                'consultation': 'fa-comments',
                'follow_up': 'fa-calendar-check',
                'emergency': 'fa-exclamation-triangle'
            };
            
            const typeLabels = {
                'treatment_planning': 'Planification',
                'consultation': 'Consultation',
                'follow_up': 'Suivi',
                'emergency': 'Urgence'
            };
            
            badges += `<span class="case-badge type-badge ${conv.case_type}">
                <i class="fas ${typeIcons[conv.case_type] || 'fa-file'}"></i>
                ${typeLabels[conv.case_type] || conv.case_type}
            </span>`;
        }
        
        // Status badge
        if (conv.status) {
            const statusColors = {
                'active': 'status-active',
                'completed': 'status-completed',
                'archived': 'status-archived'
            };
            
            const statusLabels = {
                'active': 'Actif',
                'completed': 'Complété',
                'archived': 'Archivé'
            };
            
            badges += `<span class="case-badge ${statusColors[conv.status] || ''}">
                ${statusLabels[conv.status] || conv.status}
            </span>`;
        }
        
        // Treatment plan badge
        if (conv.has_treatment_plan) {
            badges += `<span class="case-badge feature-badge">
                <i class="fas fa-tooth"></i> Plan TT
            </span>`;
            
            if (conv.treatment_plan_approved) {
                badges += `<span class="case-badge approved-badge">
                    <i class="fas fa-check"></i> Approuvé
                </span>`;
            }
        }
        
        return badges;
    }
    
    async loadConversation(conversationId) {
        try {
            appState.setState({ 
                isLoading: true,
                currentConversationId: conversationId 
            });
            
            const result = await apiClient.getConversation(conversationId);
            
            if (result.status === 'success') {
                appState.setState({ 
                    currentConversation: result.conversation,
                });
                
                // Update UI
                this.updateActiveConversation();
                
                // Load messages (delegated to messages module)
                if (window.messageManager) {
                    window.messageManager.displayMessages(result.conversation.messages);
                }
                
            }
        } catch (error) {
            console.error('Failed to load conversation:', error);
            notifications.error('Erreur lors du chargement de la conversation');
        } finally {
            appState.setState({ isLoading: false });
        }
    }
    
    updateActiveConversation() {
        // Remove active class from all items
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to current
        const activeItem = document.querySelector(`[data-conversation-id="${appState.currentConversationId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
    
    async startNewChat() {
        try {
            appState.setState({ 
                currentConversationId: null,
                currentConversation: null,
                currentTreatmentPlan: null
            });
            
            // Clear messages
            if (window.messageManager) {
                window.messageManager.clearMessages();
                window.messageManager.showWelcomeMessage();
            }
            
            this.updateActiveConversation();
            
            
        } catch (error) {
            console.error('Error starting new chat:', error);
            notifications.error('Erreur lors de la création d\'une nouvelle conversation');
        }
    }
    
    async deleteConversation(conversationId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette conversation ?')) {
            return;
        }
        
        try {
            const result = await apiClient.deleteConversation(conversationId);
            
            if (result.status === 'success') {
                notifications.success('Conversation supprimée');
                
                // Remove from state
                const conversations = appState.allConversations.filter(c => c.id !== conversationId);
                appState.setState({ allConversations: conversations });
                
                // Update display
                this.displayConversations(conversations);
                
                // If it was the active conversation, start new
                if (conversationId === appState.currentConversationId) {
                    this.startNewChat();
                }
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            notifications.error('Erreur lors de la suppression de la conversation');
        }
    }
    
    showRenameDialog(conversationId, currentTitle) {
        const newTitle = prompt('Nouveau titre:', currentTitle);
        if (newTitle && newTitle !== currentTitle) {
            this.renameConversation(conversationId, newTitle);
        }
    }
    
    async renameConversation(conversationId, newTitle) {
        try {
            const result = await apiClient.updateConversation(conversationId, { title: newTitle });
            
            if (result.status === 'success') {
                notifications.success('Conversation renommée');
                
                // Update in state
                const conversations = appState.allConversations.map(c => 
                    c.id === conversationId ? { ...c, title: newTitle } : c
                );
                appState.setState({ allConversations: conversations });
                
                // Update display
                this.displayConversations(conversations);
                
                // Update current conversation if needed
                if (conversationId === appState.currentConversationId) {
                    appState.setState({ 
                        currentConversation: { ...appState.currentConversation, title: newTitle }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to rename conversation:', error);
            notifications.error('Erreur lors du renommage de la conversation');
        }
    }
    
}

// Export singleton instance
export const conversationManager = new ConversationManager();

// Make it globally available for onclick handlers
window.conversationManager = conversationManager;