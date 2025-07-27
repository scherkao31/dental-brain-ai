/**
 * Dental Brain App Loader
 * Initializes the dental brain AI chat application
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🧠 Dental Brain AI: Initializing...');
    
    // Initialize API client
    if (window.APIClient) {
        window.apiClient = new APIClient();
        console.log('✅ API Client initialized');
    }
    
    // Initialize utilities
    if (window.utils) {
        console.log('✅ Utilities loaded');
    }
    
    // Initialize dental brain chat
    const dentalBrainContainer = document.getElementById('dental-brain');
    if (dentalBrainContainer && window.DentalBrainChat) {
        window.dentalBrainChat = new DentalBrainChat(
            dentalBrainContainer,
            window.apiClient,
            window.utils
        );
        console.log('✅ Dental Brain Chat initialized');
    }
    
    // Initialize main app functionality
    initializeMainApp();
});

function initializeMainApp() {
    // Load knowledge base statistics
    loadKnowledgeStats();
    
    // Initialize search functionality
    initializeSearch();
    
    // Initialize treatment plan display
    initializeTreatmentPlanDisplay();
}

async function loadKnowledgeStats() {
    try {
        const response = await fetch('/knowledge');
        const data = await response.json();
        
        if (data.status === 'success') {
            const totalEntries = data.statistics.total_entries || 0;
            document.getElementById('knowledge-count').textContent = totalEntries;
        }
    } catch (error) {
        console.error('Error loading knowledge stats:', error);
        document.getElementById('knowledge-count').textContent = 'Erreur';
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchResults = document.getElementById('search-results');
    
    if (!searchInput || !searchButton || !searchResults) return;
    
    // Search on button click
    searchButton.addEventListener('click', performSearch);
    
    // Search on Enter key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        
        searchResults.innerHTML = '<div class="loading">Recherche en cours...</div>';
        
        try {
            const response = await window.apiClient.searchKnowledge(query);
            displaySearchResults(response.results);
        } catch (error) {
            searchResults.innerHTML = '<div class="error">Erreur lors de la recherche</div>';
            console.error('Search error:', error);
        }
    }
    
    function displaySearchResults(results) {
        if (!results || (!results.clinical_cases?.length && !results.ideal_sequences?.length && !results.general_knowledge?.length)) {
            searchResults.innerHTML = '<div class="no-results">Aucun résultat trouvé</div>';
            return;
        }
        
        let html = '';
        
        // Display clinical cases
        if (results.clinical_cases?.length > 0) {
            html += '<div class="results-section">';
            html += '<h4>📋 Cas Cliniques</h4>';
            results.clinical_cases.forEach(item => {
                const similarity = Math.round(item.similarity_score * 100);
                html += `
                    <div class="result-item">
                        <div class="result-title">${item.title}</div>
                        <div class="result-similarity">${similarity}% similaire</div>
                        <div class="result-source">${item.source}</div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Display ideal sequences
        if (results.ideal_sequences?.length > 0) {
            html += '<div class="results-section">';
            html += '<h4>📝 Séquences Idéales</h4>';
            results.ideal_sequences.forEach(item => {
                const similarity = Math.round(item.similarity_score * 100);
                html += `
                    <div class="result-item">
                        <div class="result-title">${item.title}</div>
                        <div class="result-similarity">${similarity}% similaire</div>
                        <div class="result-source">${item.source}</div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        searchResults.innerHTML = html;
    }
}

function initializeTreatmentPlanDisplay() {
    // Listen for treatment plan events from the chat
    document.addEventListener('treatmentPlanGenerated', (event) => {
        const treatmentPlan = event.detail;
        displayTreatmentPlan(treatmentPlan);
    });
}

function displayTreatmentPlan(plan) {
    const displayArea = document.getElementById('treatment-plan-display');
    if (!displayArea || !plan || !plan.treatment_sequence) return;
    
    let html = '<div class="treatment-plan-container">';
    html += '<h3>📋 Séquence de Traitement Générée</h3>';
    
    if (plan.consultation_text) {
        html += `<div class="consultation-text">${plan.consultation_text}</div>`;
    }
    
    html += '<table class="treatment-plan-table">';
    html += `
        <thead>
            <tr>
                <th>RDV</th>
                <th>Traitement</th>
                <th>Durée</th>
                <th>Délai</th>
                <th>Dr</th>
                <th>Remarque</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    plan.treatment_sequence.forEach(appointment => {
        html += `
            <tr>
                <td>${appointment.rdv}</td>
                <td>${appointment.traitement}</td>
                <td>${appointment.duree || '-'}</td>
                <td>${appointment.delai || '-'}</td>
                <td>${appointment.dr || '-'}</td>
                <td>${appointment.remarque || '-'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    displayArea.innerHTML = html;
    displayArea.style.display = 'block';
}

// Export display function for use by other modules
window.displayTreatmentPlan = displayTreatmentPlan;