/**
 * Centralized API Client for all backend communications
 * This replaces scattered fetch calls throughout the app
 */
class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
    }

    /**
     * Generic POST request handler
     */
    async post(endpoint, data) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.status === 'error') {
                throw new Error(result.message || 'Une erreur est survenue');
            }

            return result;
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Generic GET request handler
     */
    async get(endpoint, params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = queryString ? `${this.baseURL}${endpoint}?${queryString}` : `${this.baseURL}${endpoint}`;
            
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Chat-specific API call
     */
    async sendChatMessage(message, history = [], tab = 'dental-brain', settings = null) {
        if (tab === 'schedule') {
            return await this.post('/api/ai/schedule-chat', { message });
        } else {
            // Get user settings if not provided
            const userSettings = settings || window.userSettings || {
                similarityThreshold: 60,
                clinicalCasesCount: 3,
                idealSequencesCount: 2,
                knowledgeCount: 2,
                showSimilarityScores: true,
                ragPreference: 0,
                aiModel: 'gpt-4o'
            };
            return await this.post('/api/ai/chat', { message, history, tab, settings: userSettings });
        }
    }

    /**
     * Appointment-related API calls
     */
    async getAppointments(date) {
        return await this.get('/api/appointments', { date });
    }

    async saveAppointment(appointmentData) {
        return await this.post('/api/appointments', appointmentData);
    }

    /**
     * Treatment-related API calls
     */
    async saveTreatment(treatmentData) {
        return await this.post('/api/treatments', treatmentData);
    }

    async generateTreatmentPlan(description) {
        return await this.post('/api/ai/treatment-plan', { description });
    }
}

// Create a global instance for backward compatibility
window.apiClient = new APIClient();