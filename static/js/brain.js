// Brain Interface JavaScript

let analysisData = null;
let currentTab = 'dashboard';
let knowledgeGraph = null;
let progressionChart = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we have cached analysis
    const cachedAnalysis = localStorage.getItem('brainAnalysis');
    if (cachedAnalysis) {
        analysisData = JSON.parse(cachedAnalysis);
        updateLastAnalysisTime(analysisData.timestamp);
        loadDashboard();
    }
    
    // Initial load
    analyzeKnowledge();
});

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    currentTab = tabName;
    
    // Load tab-specific content
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'patterns':
            loadPatterns();
            break;
        case 'confidence':
            loadConfidenceMap();
            break;
        case 'timeline':
            loadTimeline();
            break;
        case 'graph':
            loadKnowledgeGraph();
            break;
    }
}

// Analyze knowledge base
async function analyzeKnowledge() {
    const btn = document.getElementById('analyzeBtn');
    const overlay = document.getElementById('loadingOverlay');
    
    btn.disabled = true;
    overlay.classList.add('show');
    
    try {
        const response = await fetch('/api/brain/analyze', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to analyze knowledge base');
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            analysisData = result.data;
            localStorage.setItem('brainAnalysis', JSON.stringify(analysisData));
            updateLastAnalysisTime(analysisData.timestamp);
            
            // Refresh current tab
            switchTab(currentTab);
            
            showNotification('Analyse terminée avec succès', 'success');
        } else {
            throw new Error(result.message || 'Analysis failed');
        }
    } catch (error) {
        console.error('Error analyzing knowledge:', error);
        showNotification('Erreur lors de l\'analyse: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        overlay.classList.remove('show');
    }
}

// Update last analysis time
function updateLastAnalysisTime(timestamp) {
    const element = document.getElementById('lastAnalysis');
    if (timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        let timeText;
        if (diff < 60000) {
            timeText = 'À l\'instant';
        } else if (diff < 3600000) {
            timeText = `Il y a ${Math.floor(diff / 60000)} minutes`;
        } else if (diff < 86400000) {
            timeText = `Il y a ${Math.floor(diff / 3600000)} heures`;
        } else {
            timeText = date.toLocaleDateString('fr-FR');
        }
        
        element.innerHTML = `<i class="fas fa-clock"></i> <span>${timeText}</span>`;
    }
}

// Load dashboard
function loadDashboard() {
    if (!analysisData) return;
    
    // Update overview stats
    const overview = document.getElementById('knowledgeOverview');
    const summary = analysisData.summary;
    
    overview.innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${summary.total_clinical_cases + summary.total_ideal_sequences + summary.total_approved_sequences}</div>
            <div class="stat-label">Éléments totaux</div>
            <button class="info-btn">
                <i class="fas fa-info"></i>
                <div class="tooltip">
                    Nombre total d'éléments dans la base de connaissances incluant les cas cliniques, les séquences idéales et les séquences approuvées.
                </div>
            </button>
        </div>
        <div class="stat-item">
            <div class="stat-value">${((summary.high_quality_sequences / Math.max(1, summary.total_approved_sequences)) * 10).toFixed(1)}/10</div>
            <div class="stat-label">Qualité moyenne</div>
            <button class="info-btn">
                <i class="fas fa-info"></i>
                <div class="tooltip">
                    Note moyenne de qualité des séquences approuvées. Une note de 9+/10 indique une séquence de haute qualité validée cliniquement.
                </div>
            </button>
        </div>
        <div class="stat-item">
            <div class="stat-value">${summary.unique_conditions_covered}</div>
            <div class="stat-label">Conditions couvertes</div>
            <button class="info-btn">
                <i class="fas fa-info"></i>
                <div class="tooltip">
                    Nombre de conditions dentaires différentes (couronne, composite, facette, etc.) pour lesquelles nous avons des données de traitement.
                </div>
            </button>
        </div>
        <div class="stat-item">
            <div class="stat-value">${(summary.confidence_score * 100).toFixed(0)}%</div>
            <div class="stat-label">Confiance globale</div>
            <button class="info-btn">
                <i class="fas fa-info"></i>
                <div class="tooltip">
                    Niveau de confiance global du système basé sur la qualité et la quantité des données disponibles. Plus ce score est élevé, plus les recommandations sont fiables.
                </div>
            </button>
        </div>
    `;
    
    // Load dashboard data
    loadDashboardData();
}

// Load dashboard data from API
async function loadDashboardData() {
    try {
        const response = await fetch('/api/brain/dashboard');
        const result = await response.json();
        
        if (result.status === 'success') {
            const data = result.data;
            
            // Update top patterns
            updateTopPatterns(data.top_patterns);
            
            // Update knowledge gaps
            updateKnowledgeGaps(data.knowledge_gaps);
            
            // Update recent learnings
            updateRecentLearnings(data.recent_learnings);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Update top patterns
function updateTopPatterns(patterns) {
    const container = document.getElementById('topPatterns');
    
    if (!patterns || patterns.length === 0) {
        container.innerHTML = '<div class="no-data">Aucun pattern identifié</div>';
        return;
    }
    
    container.innerHTML = patterns.map(pattern => `
        <div class="pattern-item">
            <div class="pattern-rule">${pattern.rule}</div>
            <div class="pattern-confidence">
                <span>Confiance: ${(pattern.confidence * 100).toFixed(0)}%</span>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${pattern.confidence * 100}%"></div>
                </div>
            </div>
        </div>
    `).join('');
}

// Update knowledge gaps
function updateKnowledgeGaps(gaps) {
    const container = document.getElementById('knowledgeGaps');
    
    if (!gaps || gaps.length === 0) {
        container.innerHTML = '<div class="no-data">Aucune lacune majeure identifiée</div>';
        return;
    }
    
    container.innerHTML = gaps.map(gap => `
        <div class="gap-item">
            <div class="gap-type">${gap.type.replace(/_/g, ' ')}</div>
            <div class="gap-area">${gap.area}</div>
            <div class="gap-recommendation">${gap.recommendation}</div>
        </div>
    `).join('');
}

// Update recent learnings
function updateRecentLearnings(learnings) {
    const container = document.getElementById('recentLearnings');
    
    if (!learnings || learnings.length === 0) {
        container.innerHTML = '<div class="no-data">Aucun apprentissage récent</div>';
        return;
    }
    
    container.innerHTML = learnings.map(learning => `
        <div class="learning-item">
            <div class="learning-type">${learning.type.replace(/_/g, ' ')}</div>
            <div class="learning-description">${learning.description}</div>
            ${learning.details ? `<div class="learning-details">${learning.details}</div>` : ''}
        </div>
    `).join('');
}

// Load patterns
function loadPatterns() {
    if (!analysisData || !analysisData.rules) return;
    
    filterPatterns('all');
}

// Filter patterns
function filterPatterns(type) {
    const container = document.getElementById('rulesGrid');
    const rules = analysisData.rules;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter rules
    const filteredRules = type === 'all' ? rules : rules.filter(rule => rule.type === type);
    
    if (filteredRules.length === 0) {
        container.innerHTML = '<div class="no-data">Aucune règle trouvée</div>';
        return;
    }
    
    container.innerHTML = filteredRules.map(rule => `
        <div class="rule-card">
            <div class="rule-type">${rule.type}</div>
            <div class="rule-text">${rule.rule}</div>
            <div class="rule-meta">
                <span>Confiance: ${(rule.confidence * 100).toFixed(0)}%</span>
                ${rule.evidence_count ? `<span>${rule.evidence_count} exemples</span>` : ''}
            </div>
            ${rule.alternatives ? `
                <div class="rule-alternatives">
                    Alternatives: ${Array.isArray(rule.alternatives) ? 
                        rule.alternatives.join(', ') : 
                        Object.entries(rule.alternatives).map(([k, v]) => `${k} (${(v*100).toFixed(0)}%)`).join(', ')
                    }
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Load confidence map
async function loadConfidenceMap() {
    try {
        const response = await fetch('/api/brain/patterns/confidence_map');
        const result = await response.json();
        
        if (result.status === 'success') {
            displayConfidenceHeatmap(result.data);
        }
    } catch (error) {
        console.error('Error loading confidence map:', error);
    }
}

// Display confidence heatmap
function displayConfidenceHeatmap(confidenceData) {
    const container = document.getElementById('confidenceHeatmap');
    
    if (!confidenceData.by_condition || Object.keys(confidenceData.by_condition).length === 0) {
        container.innerHTML = '<div class="no-data">Aucune donnée de confiance disponible</div>';
        return;
    }
    
    const items = Object.entries(confidenceData.by_condition)
        .sort((a, b) => b[1].confidence - a[1].confidence)
        .map(([condition, data]) => {
            let colorClass = 'low';
            if (data.confidence >= 0.9) colorClass = 'very-high';
            else if (data.confidence >= 0.8) colorClass = 'high';
            else if (data.confidence >= 0.6) colorClass = 'medium';
            
            return `
                <div class="confidence-item ${colorClass}" style="background: ${getConfidenceColor(data.confidence)}">
                    <div class="confidence-condition">${condition.replace(/_/g, ' ').toUpperCase()}</div>
                    <div class="confidence-score">${(data.confidence * 100).toFixed(0)}%</div>
                    <div class="confidence-samples">${data.sample_size} exemples</div>
                </div>
            `;
        });
    
    container.innerHTML = items.join('');
}

// Get confidence color
function getConfidenceColor(confidence) {
    if (confidence >= 0.9) return '#065f46';
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
}

// Explore functionality
function handleExploreKeyPress(event) {
    if (event.key === 'Enter') {
        sendExploreQuery();
    }
}

async function sendExploreQuery() {
    const input = document.getElementById('exploreInput');
    const query = input.value.trim();
    
    if (!query) return;
    
    const messagesContainer = document.getElementById('exploreMessages');
    const exploreType = document.getElementById('exploreType').value;
    
    // Add user message
    messagesContainer.innerHTML += `
        <div class="explore-message user">
            <i class="fas fa-user"></i>
            <div class="message-content">${escapeHtml(query)}</div>
        </div>
    `;
    
    // Clear input
    input.value = '';
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        const response = await fetch('/api/brain/explore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                type: exploreType
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // Add AI response
            messagesContainer.innerHTML += `
                <div class="explore-message assistant">
                    <i class="fas fa-brain"></i>
                    <div class="message-content">${formatMarkdown(result.data.response)}</div>
                </div>
            `;
            
            // If there's context, show it
            if (result.data.context) {
                const context = result.data.context;
                let contextHtml = '<div class="explore-context">';
                
                if (context.knowledge_base_size) {
                    contextHtml += `<small>Basé sur ${context.knowledge_base_size.total_clinical_cases} cas cliniques et ${context.knowledge_base_size.total_approved_sequences} séquences approuvées</small>`;
                }
                
                if (context.supporting_cases && context.supporting_cases.length > 0) {
                    contextHtml += '<div class="supporting-cases"><strong>Cas de référence:</strong><ul>';
                    context.supporting_cases.forEach(c => {
                        contextHtml += `<li>${c.title} (${(c.similarity * 100).toFixed(0)}% similaire)</li>`;
                    });
                    contextHtml += '</ul></div>';
                }
                
                contextHtml += '</div>';
                messagesContainer.lastElementChild.querySelector('.message-content').innerHTML += contextHtml;
            }
        } else {
            // Add error message
            messagesContainer.innerHTML += `
                <div class="explore-message assistant error">
                    <i class="fas fa-exclamation-circle"></i>
                    <div class="message-content">Erreur: ${result.message}</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error exploring knowledge:', error);
        messagesContainer.innerHTML += `
            <div class="explore-message assistant error">
                <i class="fas fa-exclamation-circle"></i>
                <div class="message-content">Erreur de connexion</div>
            </div>
        `;
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Load timeline
async function loadTimeline() {
    try {
        const response = await fetch('/api/brain/patterns/learning_timeline');
        const result = await response.json();
        
        if (result.status === 'success') {
            displayTimeline(result.data);
        }
        
        // Load progression chart
        loadProgressionChart();
    } catch (error) {
        console.error('Error loading timeline:', error);
    }
}

// Display timeline
function displayTimeline(timelineData) {
    const container = document.getElementById('learningTimeline');
    
    if (!timelineData || timelineData.length === 0) {
        container.innerHTML = '<div class="no-data">Aucune donnée de chronologie disponible</div>';
        return;
    }
    
    container.innerHTML = timelineData.map((item, index) => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-date">${new Date(item.date).toLocaleDateString('fr-FR')}</div>
                <div class="timeline-milestone">${item.milestone}</div>
                <div class="timeline-details">${item.details}</div>
            </div>
        </div>
    `).join('');
}

// Load progression chart
async function loadProgressionChart() {
    try {
        const response = await fetch('/api/brain/insights');
        const result = await response.json();
        
        if (result.status === 'success' && result.data.complexity_progression) {
            displayProgressionChart(result.data.complexity_progression);
        }
    } catch (error) {
        console.error('Error loading progression chart:', error);
    }
}

// Display progression chart
function displayProgressionChart(progressionData) {
    const ctx = document.getElementById('progressionChart').getContext('2d');
    
    if (progressionChart) {
        progressionChart.destroy();
    }
    
    const data = progressionData.progression || [];
    
    progressionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.date).toLocaleDateString('fr-FR')),
            datasets: [{
                label: 'Complexité',
                data: data.map(d => d.complexity),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                tension: 0.1
            }, {
                label: 'Note de qualité',
                data: data.map(d => d.rating),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Progression de la complexité et de la qualité'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Complexité (nombre de RDV)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Note de qualité (/10)'
                    },
                    min: 0,
                    max: 10,
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Load knowledge graph
async function loadKnowledgeGraph() {
    try {
        const response = await fetch('/api/brain/knowledge-graph');
        const result = await response.json();
        
        if (result.status === 'success') {
            displayKnowledgeGraph(result.data);
        }
    } catch (error) {
        console.error('Error loading knowledge graph:', error);
    }
}

// Display knowledge graph using D3.js
function displayKnowledgeGraph(graphData) {
    const container = document.getElementById('knowledgeGraph');
    container.innerHTML = ''; // Clear existing
    
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create force simulation
    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));
    
    // Create links
    const link = svg.append('g')
        .selectAll('line')
        .data(graphData.edges)
        .enter().append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', d => d.weight ? Math.sqrt(d.weight) : 1);
    
    // Create nodes
    const node = svg.append('g')
        .selectAll('circle')
        .data(graphData.nodes)
        .enter().append('circle')
        .attr('r', d => d.size ? 5 + Math.sqrt(d.size) * 2 : 8)
        .attr('fill', d => {
            if (d.type === 'condition') return '#4f46e5';
            if (d.type === 'treatment') return '#10b981';
            if (d.type === 'material') return '#f59e0b';
            return '#6b7280';
        })
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Add labels
    const label = svg.append('g')
        .selectAll('text')
        .data(graphData.nodes)
        .enter().append('text')
        .text(d => d.label)
        .attr('font-size', 10)
        .attr('dx', 12)
        .attr('dy', 4);
    
    // Add tooltips
    node.append('title')
        .text(d => d.label);
    
    // Update positions
    simulation
        .nodes(graphData.nodes)
        .on('tick', ticked);
    
    simulation.force('link')
        .links(graphData.edges);
    
    function ticked() {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        
        label
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    }
    
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    knowledgeGraph = { svg, simulation, node, link, label };
}

// Graph controls
function resetGraph() {
    if (knowledgeGraph && knowledgeGraph.simulation) {
        knowledgeGraph.simulation.alpha(1).restart();
    }
}

function toggleGraphLabels() {
    if (knowledgeGraph && knowledgeGraph.label) {
        const labels = knowledgeGraph.label;
        const visible = labels.style('display') === 'none';
        labels.style('display', visible ? 'block' : 'none');
    }
}

function updateGraphFilter() {
    // Implementation for filtering connected nodes
    const showOnlyConnected = document.getElementById('showOnlyConnected').checked;
    // TODO: Implement filtering logic
}

// Test scenario modal
function openTestModal() {
    document.getElementById('testScenarioModal').classList.add('show');
}

function closeTestModal() {
    document.getElementById('testScenarioModal').classList.remove('show');
    document.getElementById('scenarioInput').value = '';
    document.getElementById('scenarioResults').innerHTML = '';
    document.getElementById('scenarioResults').classList.remove('show');
}

async function testScenario() {
    const scenario = document.getElementById('scenarioInput').value.trim();
    if (!scenario) return;
    
    const resultsDiv = document.getElementById('scenarioResults');
    resultsDiv.innerHTML = '<div class="loading">Analyse en cours...</div>';
    resultsDiv.classList.add('show');
    
    try {
        const response = await fetch('/api/brain/test-scenario', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ scenario })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            const data = result.data;
            resultsDiv.innerHTML = `
                <h4>Résultats de l'analyse</h4>
                <div class="scenario-response">
                    <strong>Réponse de l'IA:</strong>
                    <div>${formatMarkdown(data.ai_response)}</div>
                </div>
                ${data.is_treatment_plan ? `
                    <div class="scenario-plan">
                        <strong>Plan de traitement généré:</strong>
                        <pre>${JSON.stringify(data.treatment_plan, null, 2)}</pre>
                    </div>
                ` : ''}
                <div class="scenario-confidence">
                    <strong>Analyse de confiance:</strong>
                    <ul>
                        <li>Confiance globale: ${(data.confidence_analysis.overall_confidence * 100).toFixed(0)}%</li>
                        <li>Références utilisées: ${data.confidence_analysis.references_count}</li>
                        <li>Références haute similarité: ${data.confidence_analysis.high_similarity_refs}</li>
                    </ul>
                </div>
            `;
        } else {
            resultsDiv.innerHTML = `<div class="error">Erreur: ${result.message}</div>`;
        }
    } catch (error) {
        console.error('Error testing scenario:', error);
        resultsDiv.innerHTML = '<div class="error">Erreur lors du test</div>';
    }
}

// Utility functions
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatMarkdown(text) {
    // Simple markdown formatting
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/```(.*?)```/gs, '<pre>$1</pre>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 1000;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid #10b981;
        color: #065f46;
    }
    
    .notification.error {
        border-left: 4px solid #ef4444;
        color: #991b1b;
    }
    
    .notification.info {
        border-left: 4px solid #3b82f6;
        color: #1e40af;
    }
    
    .explore-context {
        margin-top: 1rem;
        padding: 0.75rem;
        background: #f3f4f6;
        border-radius: 6px;
        font-size: 0.875rem;
    }
    
    .supporting-cases ul {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
    }
    
    .rule-alternatives {
        margin-top: 0.5rem;
        font-size: 0.875rem;
        color: #6b7280;
    }
    
    .no-data {
        text-align: center;
        padding: 2rem;
        color: #9ca3af;
    }
    
    .error {
        color: #ef4444;
        padding: 1rem;
        background: #fee2e2;
        border-radius: 6px;
    }
`;
document.head.appendChild(style);