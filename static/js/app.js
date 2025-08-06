// Main Application Entry Point
// Coordinates all modules and initializes the app

import { apiClient } from './modules/api-client.js';
import { appState } from './modules/state.js';
import { conversationManager } from './modules/conversations.js';
import { messageManager } from './modules/messages.js';
import { notifications } from './modules/notifications.js';
import { DOMUtils } from './modules/dom-utils.js';
import { filterManager } from './modules/filters.js';
import { modalManager } from './modules/modals.js';
import { loadingManager } from './modules/loading.js';

class DentalBrainApp {
    constructor() {
        this.modules = {
            apiClient,
            appState,
            conversationManager,
            messageManager,
            notifications,
            filterManager,
            modalManager,
            loadingManager
        };
    }
    
    async init() {
        try {
            // Check authentication
            await this.checkAuth();
            
            // Load initial data
            await Promise.all([
                this.loadUserProfile(),
                this.loadUserSettings(),
                conversationManager.loadConversations()
            ]);
            
            // Setup UI
            this.setupEventListeners();
            this.initializeTheme();
            this.updateChatInput();
            
            // Show welcome message
            messageManager.showWelcomeMessage();
            
            // Restore filter state
            this.restoreFilterState();
            
            
        } catch (error) {
            console.error('App initialization failed:', error);
            notifications.error('Erreur lors de l\'initialisation de l\'application');
        }
    }
    
    async checkAuth() {
        try {
            const result = await apiClient.checkAuth();
            
            if (!result.authenticated) {
                window.location.href = '/login';
            } else {
                appState.setState({ currentUser: result.user });
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/login';
        }
    }
    
    async loadUserProfile() {
        if (appState.currentUser) {
            const displayName = document.getElementById('userDisplayName');
            if (displayName) {
                displayName.textContent = appState.currentUser.full_name || appState.currentUser.username;
            }
        }
    }
    
    async loadUserSettings() {
        try {
            const result = await apiClient.getUserSettings();
            
            if (result.status === 'success' && result.settings) {
                appState.setState({ userSettings: { ...appState.userSettings, ...result.settings } });
            }
        } catch (error) {
            console.error('Failed to load user settings:', error);
        }
    }
    
    setupEventListeners() {
        // Global functions for HTML onclick handlers
        window.startNewChat = () => conversationManager.startNewChat();
        window.loadConversation = (id) => conversationManager.loadConversation(id);
        window.sendMessage = () => messageManager.sendMessage();
        window.sendSuggestion = (text) => messageManager.sendSuggestion(text);
        window.sendQuickAction = (action) => messageManager.sendQuickAction(action);
        window.handleInputKeydown = (e) => messageManager.handleInputKeydown(e);
        window.autoResizeTextarea = (textarea) => messageManager.autoResizeTextarea(textarea);
        
        // Settings functions
        window.showSettings = () => this.showSettings();
        window.closeSettings = () => this.closeSettings();
        window.saveSettings = () => this.saveSettings();
        window.resetSettings = () => this.resetSettings();
        window.switchSettingsTab = (tab) => this.switchSettingsTab(tab);
        
        // Profile functions
        window.showUserProfile = () => this.showUserProfile();
        window.closeUserProfile = () => this.closeUserProfile();
        window.updateProfile = (e) => this.updateProfile(e);
        window.changePassword = (e) => this.changePassword(e);
        window.toggleTheme = () => this.toggleTheme();
        
        // Other global functions
        window.handleLogout = () => this.handleLogout();
        window.showNotification = (type, message) => notifications[type](message);
        
        // Search functions
        window.showSearchPanel = () => this.showSearchPanel();
        window.closeSearchPanel = () => this.closeSearchPanel();
        window.performSearch = () => this.performSearch();
        window.handleSearchKeydown = (e) => this.handleSearchKeydown(e);
        
    }
    
    updateChatInput() {
        const enabled = !appState.isLoading;
        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');
        
        if (sendBtn) sendBtn.disabled = !enabled;
        if (chatInput) chatInput.disabled = !enabled;
    }
    
    updateQuickActionButtons() {
        // Quick action buttons are now always enabled
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.disabled = false;
        });
    }
    
    initializeTheme() {
        const theme = appState.userSettings.theme || 'dark';
        document.body.setAttribute('data-theme', theme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.checked = theme === 'dark';
        }
    }
    
    async toggleTheme() {
        const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        
        appState.userSettings.theme = newTheme;
        
        const themeLabel = document.getElementById('themeLabel');
        if (themeLabel) {
            themeLabel.textContent = newTheme === 'dark' ? 'Mode sombre' : 'Mode clair';
        }
        
        // Save to backend
        try {
            await apiClient.saveUserSettings({ theme: newTheme });
        } catch (error) {
            console.error('Failed to save theme:', error);
        }
    }
    
    showSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            DOMUtils.show(modal, 'flex');
            this.loadSettingsValues();
        }
    }
    
    closeSettings() {
        DOMUtils.hide('settingsModal');
    }
    
    loadSettingsValues() {
        const settings = appState.userSettings;
        
        // RAG settings
        document.getElementById('ragPreference').value = settings.ragPreference;
        document.getElementById('similarityThreshold').value = settings.similarityThreshold;
        document.getElementById('clinicalCasesCount').value = settings.clinicalCasesCount;
        document.getElementById('idealSequencesCount').value = settings.idealSequencesCount;
        document.getElementById('knowledgeCount').value = settings.knowledgeCount;
        document.getElementById('reasoningMode').value = settings.reasoningMode;
        document.getElementById('showSimilarityScores').checked = settings.showSimilarityScores;
        document.getElementById('explainReasoning').checked = settings.explainReasoning;
        
        // Display settings
        document.getElementById('autoExpandTreatment').checked = settings.autoExpandTreatment;
        document.getElementById('compactView').checked = settings.compactView;
        // REMOVED: showFinancialAnalysis setting
        document.getElementById('currencySelect').value = settings.currency;
        
        // Update displays
        this.updateRagPreferenceDisplay(settings.ragPreference);
        this.updateSimilarityDisplay(settings.similarityThreshold);
    }
    
    async saveSettings() {
        const settings = {
            // RAG settings
            ragPreference: parseInt(document.getElementById('ragPreference').value),
            similarityThreshold: parseInt(document.getElementById('similarityThreshold').value),
            clinicalCasesCount: parseInt(document.getElementById('clinicalCasesCount').value),
            idealSequencesCount: parseInt(document.getElementById('idealSequencesCount').value),
            knowledgeCount: parseInt(document.getElementById('knowledgeCount').value),
            reasoningMode: document.getElementById('reasoningMode').value,
            showSimilarityScores: document.getElementById('showSimilarityScores').checked,
            explainReasoning: document.getElementById('explainReasoning').checked,
            
            // Display settings
            autoExpandTreatment: document.getElementById('autoExpandTreatment').checked,
            compactView: document.getElementById('compactView').checked,
            // REMOVED: showFinancialAnalysis
            currency: document.getElementById('currencySelect').value
        };
        
        try {
            const result = await apiClient.saveUserSettings(settings);
            
            if (result.status === 'success') {
                appState.setState({ userSettings: { ...appState.userSettings, ...settings } });
                notifications.success('Paramètres enregistrés');
                this.closeSettings();
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            notifications.error('Erreur lors de l\'enregistrement des paramètres');
        }
    }
    
    resetSettings() {
        if (confirm('Réinitialiser tous les paramètres par défaut ?')) {
            // Reset to defaults
            const defaults = {
                ragPreference: 0,
                similarityThreshold: 60,
                clinicalCasesCount: 3,
                idealSequencesCount: 2,
                knowledgeCount: 2,
                reasoningMode: 'adaptive',
                showSimilarityScores: true,
                explainReasoning: true,
                autoExpandTreatment: true,
                compactView: false,
                // REMOVED: showFinancialAnalysis
                currency: 'CHF'
            };
            
            appState.setState({ userSettings: { ...appState.userSettings, ...defaults } });
            this.loadSettingsValues();
            notifications.info('Paramètres réinitialisés');
        }
    }
    
    switchSettingsTab(tabName) {
        // Update active tab
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update active content
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`${tabName}Settings`).style.display = 'block';
    }
    
    updateRagPreferenceDisplay(value) {
        const display = document.getElementById('ragPreferenceValue');
        if (display) {
            let text = 'Équilibré (0)';
            if (value < -50) text = `Cas cliniques (${value})`;
            else if (value > 50) text = `Séquences idéales (${value})`;
            else if (value < 0) text = `Légèrement cas cliniques (${value})`;
            else if (value > 0) text = `Légèrement séquences (${value})`;
            
            display.textContent = text;
        }
        
        // Make this global for HTML handlers
        window.updateRagPreferenceDisplay = (value) => this.updateRagPreferenceDisplay(value);
    }
    
    updateSimilarityDisplay(value) {
        const display = document.getElementById('similarityValue');
        if (display) {
            display.textContent = `${value}%`;
        }
        
        // Make this global for HTML handlers
        window.updateSimilarityDisplay = (value) => this.updateSimilarityDisplay(value);
    }
    
    showUserProfile() {
        const modal = document.getElementById('userProfileModal');
        if (modal) {
            DOMUtils.show(modal, 'flex');
            this.loadProfileValues();
        }
    }
    
    closeUserProfile() {
        DOMUtils.hide('userProfileModal');
    }
    
    loadProfileValues() {
        if (appState.currentUser) {
            document.getElementById('profileEmail').value = appState.currentUser.email || '';
            document.getElementById('profileFullName').value = appState.currentUser.full_name || '';
            document.getElementById('profileUsername').value = appState.currentUser.username || '';
        }
    }
    
    async updateProfile(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const data = {
            email: formData.get('email'),
            full_name: formData.get('full_name')
        };
        
        try {
            const result = await apiClient.updateUserProfile(data);
            
            if (result.status === 'success') {
                appState.setState({ 
                    currentUser: { ...appState.currentUser, ...data }
                });
                
                this.loadUserProfile();
                notifications.success('Profil mis à jour');
                this.closeUserProfile();
            }
        } catch (error) {
            console.error('Failed to update profile:', error);
            notifications.error('Erreur lors de la mise à jour du profil');
        }
    }
    
    async changePassword(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const data = {
            current_password: formData.get('current_password'),
            new_password: formData.get('new_password')
        };
        
        try {
            const result = await apiClient.request('/api/user/change-password', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            if (result.status === 'success') {
                notifications.success('Mot de passe modifié');
                event.target.reset();
            }
        } catch (error) {
            console.error('Failed to change password:', error);
            notifications.error(error.message || 'Erreur lors du changement de mot de passe');
        }
    }
    
    async handleLogout() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            try {
                await apiClient.logout();
                window.location.href = '/login';
            } catch (error) {
                console.error('Logout failed:', error);
                // Force redirect anyway
                window.location.href = '/login';
            }
        }
    }
    
    async showSearchPanel() {
        DOMUtils.show('searchPanel', 'flex');
        document.getElementById('searchInput').focus();
    }
    
    closeSearchPanel() {
        DOMUtils.hide('searchPanel');
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }
    
    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;
        
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '<div class="search-loading">Recherche en cours...</div>';
        
        try {
            const result = await apiClient.search(query);
            
            if (result.status === 'success') {
                this.displaySearchResults(result.results);
            }
        } catch (error) {
            console.error('Search failed:', error);
            resultsContainer.innerHTML = '<div class="search-error">Erreur lors de la recherche</div>';
        }
    }
    
    displaySearchResults(results) {
        const container = document.getElementById('searchResults');
        
        if (!results || results.length === 0) {
            container.innerHTML = '<div class="search-empty">Aucun résultat trouvé</div>';
            return;
        }
        
        let html = '<div class="search-results-list">';
        
        results.forEach(result => {
            html += messageManager.createReferenceItem(result);
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    handleSearchKeydown(event) {
        if (event.key === 'Enter') {
            this.performSearch();
        } else if (event.key === 'Escape') {
            this.closeSearchPanel();
        }
    }
    
    restoreFilterState() {
        // Delegate to filter manager
        const hasFilters = filterManager.loadFilterState();
        if (hasFilters) {
            filterManager.applyFilters();
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new DentalBrainApp();
    app.init();
    
    // Export for debugging
    window.dentalBrainApp = app;
});