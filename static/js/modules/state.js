// State Management Module
// Centralizes all application state in one place

class AppState {
    constructor() {
        this.currentConversationId = null;
        this.currentUser = null;
        this.isLoading = false;
        this.allConversations = [];
        this.currentConversation = null;
        this.currentTreatmentPlan = null;
        this.draggedElement = null;
        this.userSettings = {
            theme: 'dark',
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
            currency: 'CHF'
        };
        
        // Subscribe to state changes
        this.subscribers = [];
    }
    
    // Subscribe to state changes
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }
    
    // Notify subscribers of state change
    notify(changedProperty) {
        this.subscribers.forEach(callback => callback(changedProperty, this));
    }
    
    // Update state with notification
    setState(updates) {
        Object.keys(updates).forEach(key => {
            this[key] = updates[key];
            this.notify(key);
        });
    }
    
    // Getters for computed state
    get hasActiveConversation() {
        return this.currentConversationId !== null;
    }
    
    get isAuthenticated() {
        return this.currentUser !== null;
    }
}

// Export singleton instance
export const appState = new AppState();