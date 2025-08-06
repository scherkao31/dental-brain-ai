// Filters Module
// Handles conversation filtering and search

import { appState } from './state.js';
import { conversationManager } from './conversations.js';
import { DOMUtils } from './dom-utils.js';

class FilterManager {
    constructor() {
        this.filters = {
            patient: '',
            status: '',
            caseType: '',
            dateRange: '',
            search: ''
        };
        this.init();
    }
    
    init() {
        // Set up filter event listeners
        this.setupFilterListeners();
        
        // Subscribe to conversation changes
        appState.subscribe((property) => {
            if (property === 'allConversations') {
                this.applyFilters();
            }
        });
    }
    
    setupFilterListeners() {
        // Patient filter
        const patientFilter = document.getElementById('patientFilter');
        if (patientFilter) {
            patientFilter.addEventListener('change', (e) => {
                this.filters.patient = e.target.value;
                this.applyFilters();
                this.saveFilterState();
            });
        }
        
        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.applyFilters();
                this.saveFilterState();
            });
        }
        
        // Case type filter
        const caseTypeFilter = document.getElementById('caseTypeFilter');
        if (caseTypeFilter) {
            caseTypeFilter.addEventListener('change', (e) => {
                this.filters.caseType = e.target.value;
                this.applyFilters();
                this.saveFilterState();
            });
        }
        
        // Date range filter
        const dateRangeFilter = document.getElementById('dateRangeFilter');
        if (dateRangeFilter) {
            dateRangeFilter.addEventListener('change', (e) => {
                this.filters.dateRange = e.target.value;
                this.applyFilters();
                this.saveFilterState();
            });
        }
        
        // Search filter
        const searchFilter = document.getElementById('conversationSearch');
        if (searchFilter) {
            searchFilter.addEventListener('input', DOMUtils.debounce((e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.applyFilters();
            }, 300));
        }
    }
    
    applyFilters() {
        const conversations = appState.allConversations || [];
        
        let filtered = conversations.filter(conv => {
            // Patient filter
            if (this.filters.patient && conv.patient_id !== parseInt(this.filters.patient)) {
                return false;
            }
            
            // Status filter
            if (this.filters.status && conv.status !== this.filters.status) {
                return false;
            }
            
            // Case type filter
            if (this.filters.caseType && conv.case_type !== this.filters.caseType) {
                return false;
            }
            
            // Date range filter
            if (this.filters.dateRange) {
                const convDate = new Date(conv.updated_at);
                const now = new Date();
                
                switch (this.filters.dateRange) {
                    case 'today':
                        if (!this.isToday(convDate)) return false;
                        break;
                    case 'week':
                        if (!this.isThisWeek(convDate)) return false;
                        break;
                    case 'month':
                        if (!this.isThisMonth(convDate)) return false;
                        break;
                    case 'older':
                        if (this.isThisMonth(convDate)) return false;
                        break;
                }
            }
            
            // Search filter
            if (this.filters.search) {
                const searchableText = [
                    conv.title,
                    conv.patient?.display_name,
                    conv.patient?.patient_number
                ].filter(Boolean).join(' ').toLowerCase();
                
                if (!searchableText.includes(this.filters.search)) {
                    return false;
                }
            }
            
            return true;
        });
        
        // Sort by updated date
        filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        // Update display
        conversationManager.displayConversations(filtered);
        
        // Update count
        this.updateFilterCount(filtered.length, conversations.length);
    }
    
    updateFilterCount(filtered, total) {
        const countElement = document.getElementById('filterCount');
        if (countElement) {
            if (filtered < total) {
                countElement.textContent = `${filtered} / ${total} conversations`;
                DOMUtils.show(countElement);
            } else {
                DOMUtils.hide(countElement);
            }
        }
    }
    
    clearFilters() {
        // Reset all filters
        this.filters = {
            patient: '',
            status: '',
            caseType: '',
            dateRange: '',
            search: ''
        };
        
        // Reset UI
        const elements = [
            'patientFilter',
            'statusFilter',
            'caseTypeFilter',
            'dateRangeFilter',
            'conversationSearch'
        ];
        
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        
        // Apply empty filters
        this.applyFilters();
        this.saveFilterState();
    }
    
    saveFilterState() {
        localStorage.setItem('dentalBrainFilters', JSON.stringify(this.filters));
    }
    
    loadFilterState() {
        const saved = localStorage.getItem('dentalBrainFilters');
        if (saved) {
            try {
                this.filters = JSON.parse(saved);
                
                // Apply to UI
                Object.entries(this.filters).forEach(([key, value]) => {
                    const elementId = key === 'search' ? 'conversationSearch' : `${key}Filter`;
                    const element = document.getElementById(elementId);
                    if (element && value) {
                        element.value = value;
                    }
                });
                
                return true;
            } catch (error) {
                console.error('Failed to load filter state:', error);
            }
        }
        return false;
    }
    
    // Date helper methods
    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }
    
    isThisWeek(date) {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date > weekAgo;
    }
    
    isThisMonth(date) {
        const now = new Date();
        return date.getMonth() === now.getMonth() && 
               date.getFullYear() === now.getFullYear();
    }
}

// Export singleton instance
export const filterManager = new FilterManager();

// Make it globally available for onclick handlers
window.filterManager = filterManager;
window.clearFilters = () => filterManager.clearFilters();