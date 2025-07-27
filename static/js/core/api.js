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
    async sendChatMessage(message, history = [], tab = 'dental-brain') {
        if (tab === 'schedule') {
            return await this.post('/api/ai/schedule-chat', { message });
        } else {
            return await this.post('/api/ai/chat', { message, history, tab });
        }
    }

    /**
     * Patient-related API calls
     */
    async searchPatients(query) {
        return await this.get('/api/patients/search', { q: query });
    }

    async getPatient(patientId) {
        return await this.get(`/api/patients/${patientId}`);
    }

    async savePatient(patientData) {
        return await this.post('/api/patients', patientData);
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

    async generateTreatmentPlan(patientId, description) {
        return await this.post('/api/ai/treatment-plan', { patient_id: patientId, description });
    }
}

// Create a global instance for backward compatibility
window.apiClient = new APIClient();