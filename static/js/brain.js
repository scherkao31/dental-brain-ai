// Brain Interface - Multi-Agent Analysis System

let analysisState = {
    isRunning: false,
    progress: 0,
    discoveredRules: [],
    agentThoughts: [],
    currentStage: '',
    analysisId: null
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Brain multi-agent system initialized');
    
    // Check for saved analysis
    checkSavedAnalysis();
    
    // Apply theme if needed
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    }
});

// Check if there's a saved analysis
async function checkSavedAnalysis() {
    try {
        const response = await fetch('/api/brain/check-analysis');
        const data = await response.json();
        
        if (data.status === 'success' && data.hasAnalysis) {
            // Load saved analysis
            analysisState.discoveredRules = data.rules || [];
            displaySavedAnalysis();
        }
    } catch (error) {
        console.error('Error checking saved analysis:', error);
    }
}

// Display saved analysis
function displaySavedAnalysis() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('analysisContainer').style.display = 'block';
    document.getElementById('startAnalysisBtn').style.display = 'none';
    document.getElementById('resetAnalysisBtn').style.display = 'block';
    
    // Show discovered rules
    displayRules(analysisState.discoveredRules);
    
    // Show completion message
    document.getElementById('analysisComplete').style.display = 'block';
    document.getElementById('totalRules').textContent = analysisState.discoveredRules.length;
}

// Start the smart analysis
async function startSmartAnalysis() {
    if (analysisState.isRunning) return;
    
    analysisState.isRunning = true;
    analysisState.progress = 0;
    analysisState.discoveredRules = [];
    analysisState.agentThoughts = [];
    
    // Update UI
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('analysisContainer').style.display = 'block';
    document.getElementById('startAnalysisBtn').style.display = 'none';
    document.getElementById('analysisComplete').style.display = 'none';
    
    try {
        // Start the analysis
        const response = await fetch('/api/brain/start-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            analysisState.analysisId = data.analysisId;
            
            // Start polling for updates
            pollAnalysisProgress();
        } else {
            throw new Error(data.message || 'Failed to start analysis');
        }
    } catch (error) {
        console.error('Error starting analysis:', error);
        alert('Erreur lors du démarrage de l\'analyse: ' + error.message);
        resetAnalysis();
    }
}

// Poll for analysis progress
async function pollAnalysisProgress() {
    if (!analysisState.isRunning) return;
    
    try {
        const response = await fetch(`/api/brain/analysis-progress/${analysisState.analysisId}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            updateProgress(data.progress);
            
            // Add new thoughts
            if (data.newThoughts && data.newThoughts.length > 0) {
                data.newThoughts.forEach(thought => addAgentThought(thought));
            }
            
            // Add new rules
            if (data.newRules && data.newRules.length > 0) {
                data.newRules.forEach(rule => addDiscoveredRule(rule));
            }
            
            // Check if complete
            if (data.isComplete) {
                completeAnalysis();
            } else {
                // Continue polling
                setTimeout(() => pollAnalysisProgress(), 1000);
            }
        }
    } catch (error) {
        console.error('Error polling progress:', error);
        // Continue polling despite errors
        setTimeout(() => pollAnalysisProgress(), 2000);
    }
}

// Update progress
function updateProgress(progress) {
    analysisState.progress = progress.percentage;
    analysisState.currentStage = progress.stage;
    
    document.querySelector('.progress-percentage').textContent = `${progress.percentage}%`;
    document.getElementById('progressFill').style.width = `${progress.percentage}%`;
    document.getElementById('currentStage').textContent = progress.stage;
}

// Add agent thought to the thinking visualization
function addAgentThought(thought) {
    const container = document.getElementById('thinkingContainer');
    
    const thoughtEl = document.createElement('div');
    thoughtEl.className = `agent-thought ${thought.agent}`;
    thoughtEl.innerHTML = `
        <div class="thought-header">
            <i class="fas ${getAgentIcon(thought.agent)}"></i>
            <span class="agent-name">${getAgentName(thought.agent)}</span>
            <span class="thought-time">${formatTime(thought.timestamp)}</span>
        </div>
        <div class="thought-content">${thought.content}</div>
    `;
    
    container.appendChild(thoughtEl);
    
    // Auto-scroll to latest thought
    container.scrollTop = container.scrollHeight;
}

// Add discovered rule
function addDiscoveredRule(rule) {
    analysisState.discoveredRules.push(rule);
    
    const rulesGrid = document.getElementById('rulesGrid');
    
    const ruleCard = document.createElement('div');
    ruleCard.className = `rule-card ${rule.type}`;
    ruleCard.onclick = () => showRuleDetail(rule);
    
    const confidenceBadgeClass = rule.confidence >= 80 ? 'high' : 
                                rule.confidence >= 60 ? 'medium' : 'low';
    
    ruleCard.innerHTML = `
        <div class="rule-header">
            <h4 class="rule-title">${rule.title}</h4>
            <div class="rule-confidence">
                <span class="confidence-badge ${confidenceBadgeClass}">
                    ${rule.confidence}%
                </span>
            </div>
        </div>
        <p class="rule-summary">${rule.summary}</p>
        <div class="rule-stats">
            <span class="rule-stat">
                <i class="fas fa-file-medical"></i> ${rule.evidenceCount} cas
            </span>
            <span class="rule-stat">
                <i class="fas fa-tag"></i> ${getRuleTypeLabel(rule.type)}
            </span>
        </div>
    `;
    
    rulesGrid.appendChild(ruleCard);
}

// Complete analysis
function completeAnalysis() {
    analysisState.isRunning = false;
    
    // Update progress to 100%
    updateProgress({ percentage: 100, stage: 'Analyse terminée' });
    
    // Show completion message
    setTimeout(() => {
        document.getElementById('analysisComplete').style.display = 'block';
        document.getElementById('totalRules').textContent = analysisState.discoveredRules.length;
        document.getElementById('resetAnalysisBtn').style.display = 'block';
    }, 1000);
}

// Reset analysis
function resetAnalysis() {
    if (confirm('Êtes-vous sûr de vouloir lancer une nouvelle analyse ? Les résultats actuels seront remplacés.')) {
        analysisState = {
            isRunning: false,
            progress: 0,
            discoveredRules: [],
            agentThoughts: [],
            currentStage: '',
            analysisId: null
        };
        
        // Clear UI
        document.getElementById('thinkingContainer').innerHTML = '';
        document.getElementById('rulesGrid').innerHTML = '';
        document.getElementById('analysisContainer').style.display = 'none';
        document.getElementById('analysisComplete').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'block';
        document.getElementById('startAnalysisBtn').style.display = 'block';
        document.getElementById('resetAnalysisBtn').style.display = 'none';
        
        // Reset progress
        updateProgress({ percentage: 0, stage: 'En attente...' });
    }
}

// Show rule detail
function showRuleDetail(rule) {
    document.getElementById('ruleTitle').textContent = rule.title;
    document.getElementById('ruleDescription').textContent = rule.description;
    document.getElementById('ruleClinicalReasoning').textContent = rule.clinicalReasoning;
    
    // Display evidence
    const evidenceHtml = rule.evidence.map(e => 
        `<div class="evidence-item">${e}</div>`
    ).join('');
    document.getElementById('ruleEvidence').innerHTML = evidenceHtml;
    
    // Display exceptions
    const exceptionsHtml = rule.exceptions.length > 0 ?
        rule.exceptions.map(e => 
            `<div class="exception-item">${e}</div>`
        ).join('') :
        '<p style="color: #6b7280;">Aucune exception identifiée</p>';
    document.getElementById('ruleExceptions').innerHTML = exceptionsHtml;
    
    // Update confidence bar
    document.getElementById('ruleConfidenceFill').style.width = `${rule.confidence}%`;
    document.getElementById('ruleConfidenceValue').textContent = `${rule.confidence}%`;
    
    // Show modal
    document.getElementById('ruleModal').style.display = 'flex';
}

// Close rule modal
function closeRuleModal() {
    document.getElementById('ruleModal').style.display = 'none';
}

// Filter rules
function filterRules(filterType) {
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter rules
    const rulesToShow = filterType === 'all' ? analysisState.discoveredRules :
                       filterType === 'high' ? analysisState.discoveredRules.filter(r => r.confidence >= 80) :
                       analysisState.discoveredRules.filter(r => r.type === filterType);
    
    // Update display
    displayRules(rulesToShow);
}

// Display rules
function displayRules(rules) {
    const rulesGrid = document.getElementById('rulesGrid');
    rulesGrid.innerHTML = '';
    
    rules.forEach(rule => addDiscoveredRule(rule));
}

// Helper functions
function getAgentIcon(agent) {
    const icons = {
        scanner: 'fa-search',
        analyzer: 'fa-microscope',
        synthesizer: 'fa-lightbulb',
        validator: 'fa-check-circle'
    };
    return icons[agent] || 'fa-robot';
}

function getAgentName(agent) {
    const names = {
        scanner: 'Scanner Agent',
        analyzer: 'Analyzer Agent',
        synthesizer: 'Synthesizer Agent',
        validator: 'Validator Agent'
    };
    return names[agent] || 'Agent';
}

function getRuleTypeLabel(type) {
    const labels = {
        pattern: 'Pattern',
        timing: 'Timing',
        material: 'Matériaux',
        dependency: 'Dépendance',
        contraindication: 'Contre-indication',
        success_factor: 'Facteur de succès'
    };
    return labels[type] || type;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('ruleModal');
    if (event.target === modal) {
        closeRuleModal();
    }
}