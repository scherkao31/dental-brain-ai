// API Client Module
// Centralizes all API calls with proper error handling

import { SecurityUtils } from './validation.js';

class APIClient {
    constructor() {
        this.baseURL = '';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }
    
    // Generic request handler with error handling
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.defaultHeaders,
                    ...options.headers
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
            
            if (data.status === 'error') {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    // Auth endpoints
    async checkAuth() {
        return this.request('/auth/check');
    }
    
    async login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }
    
    async logout() {
        return this.request('/auth/logout', {
            method: 'POST'
        });
    }
    
    // User endpoints
    async getUserProfile() {
        return this.request('/api/user/profile');
    }
    
    async updateUserProfile(data) {
        return this.request('/api/user/profile', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async getUserSettings() {
        return this.request('/api/user/settings');
    }
    
    async saveUserSettings(settings) {
        return this.request('/api/user/settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }
    
    // Conversation endpoints
    async getConversations() {
        return this.request('/api/user/conversations');
    }
    
    async getConversation(id) {
        return this.request(`/api/user/conversations/${id}`);
    }
    
    async createConversation() {
        return this.request('/api/user/conversations', {
            method: 'POST',
            body: JSON.stringify({})
        });
    }
    
    async updateConversation(id, data) {
        return this.request(`/api/user/conversations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    async deleteConversation(id) {
        return this.request(`/api/user/conversations/${id}`, {
            method: 'DELETE'
        });
    }
    
    // AI endpoints
    async sendMessage(message, conversationId, history = []) {
        return this.request('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify({
                message,
                conversation_id: conversationId,
                history,
                tab: 'dental-brain'
            })
        });
    }
    
    async search(query, types = ['clinical_case', 'ideal_sequence', 'knowledge']) {
        return this.request('/api/ai/search', {
            method: 'POST',
            body: JSON.stringify({ query, types })
        });
    }
    
    async getReference(referenceId) {
        return this.request(`/api/ai/reference/${referenceId}`);
    }
    
}

// Export singleton instance
export const apiClient = new APIClient();