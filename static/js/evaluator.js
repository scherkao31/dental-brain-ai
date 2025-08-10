// Evaluator JavaScript

class Evaluator {
    constructor() {
        this.currentTab = 'test-cases';
        this.testCases = [];
        this.pendingSequences = [];
        this.evaluatedSequences = [];
        this.analytics = {};
        this.charts = {};
        
        this.init();
    }
    
    init() {
        this.setupTabNavigation();
        this.loadInitialData();
        this.setupEventListeners();
    }
    
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });
    }
    
    switchTab(tab) {
        // Update buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Update panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tab}-tab`);
        });
        
        this.currentTab = tab;
        
        // Load data for the tab
        switch(tab) {
            case 'test-cases':
                this.loadTestCases();
                break;
            case 'pending':
                this.loadPendingSequences();
                break;
            case 'evaluated':
                this.loadEvaluatedSequences();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }
    
    setupEventListeners() {
        // Sort and filter controls
        document.getElementById('pendingSort')?.addEventListener('change', () => {
            this.loadPendingSequences();
        });
        
        document.getElementById('evaluatedFilter')?.addEventListener('change', () => {
            this.loadEvaluatedSequences();
        });
        
        // Time range selector
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.loadAnalytics(parseInt(e.target.dataset.days));
            });
        });
    }
    
    async loadInitialData() {
        try {
            // Load overview stats
            const response = await fetch('/analytics/overview');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.updateHeaderStats(data.analytics);
            }
            
            // Load initial tab
            this.loadTestCases();
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }
    
    updateHeaderStats(analytics) {
        document.getElementById('totalTestCases').textContent = analytics.total_test_cases;
        document.getElementById('totalSequences').textContent = analytics.total_sequences;
        document.getElementById('totalEvaluations').textContent = analytics.total_evaluations;
        
        const avgScore = analytics.average_scores.overall;
        document.getElementById('averageScore').textContent = avgScore ? avgScore.toFixed(1) : '-';
        
        // Update badges
        document.getElementById('testCasesBadge').textContent = analytics.total_test_cases;
        // Will update pending/evaluated badges when loading those tabs
    }
    
    async loadTestCases() {
        try {
            const response = await fetch('/test-cases');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.testCases = data.test_cases;
                this.renderTestCases();
            }
        } catch (error) {
            console.error('Error loading test cases:', error);
        }
    }
    
    renderTestCases() {
        const grid = document.getElementById('testCasesGrid');
        
        if (this.testCases.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-vial fa-3x mb-3"></i>
                    <h3>Aucun cas de test</h3>
                    <p>Créez votre premier cas de test pour commencer l'évaluation</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = this.testCases.map(testCase => `
            <div class="test-case-card" data-id="${testCase.id}">
                <div class="test-case-header">
                    <div>
                        <span class="difficulty-badge difficulty-${testCase.difficulty_level}">
                            ${this.getDifficultyLabel(testCase.difficulty_level)}
                        </span>
                    </div>
                    <div class="test-case-meta">
                        <span><i class="fas fa-robot"></i> ${testCase.evaluation_count}</span>
                        ${testCase.average_score ? `<span><i class="fas fa-star"></i> ${testCase.average_score}</span>` : ''}
                    </div>
                </div>
                
                <div class="test-case-consultation">
                    ${this.escapeHtml(testCase.consultation_text)}
                </div>
                
                ${testCase.categories.length > 0 ? `
                    <div class="test-case-categories">
                        ${testCase.categories.map(cat => `
                            <span class="category-tag">${cat}</span>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="test-case-actions">
                    <button class="btn btn-sm btn-primary" onclick="evaluator.generateSequence(${testCase.id})">
                        <i class="fas fa-robot me-1"></i>Générer
                    </button>
                    <button class="btn btn-sm btn-outline-primary" onclick="evaluator.editTestCase(${testCase.id})">
                        <i class="fas fa-edit me-1"></i>Modifier
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    async loadPendingSequences() {
        try {
            const response = await fetch('/sequences/pending');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.pendingSequences = data.pending_sequences;
                document.getElementById('pendingBadge').textContent = this.pendingSequences.length;
                this.renderPendingSequences();
            }
        } catch (error) {
            console.error('Error loading pending sequences:', error);
        }
    }
    
    renderPendingSequences() {
        const container = document.getElementById('pendingSequences');
        
        if (this.pendingSequences.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-hourglass-half fa-3x mb-3"></i>
                    <h3>Aucune séquence en attente</h3>
                    <p>Générez des séquences depuis les cas de test pour les évaluer</p>
                </div>
            `;
            return;
        }
        
        const sort = document.getElementById('pendingSort').value;
        let sorted = [...this.pendingSequences];
        
        switch(sort) {
            case 'oldest':
                sorted.sort((a, b) => new Date(a.generated_at) - new Date(b.generated_at));
                break;
            case 'difficulty':
                sorted.sort((a, b) => {
                    const diffOrder = {easy: 0, medium: 1, hard: 2, expert: 3};
                    return diffOrder[b.test_case.difficulty_level] - diffOrder[a.test_case.difficulty_level];
                });
                break;
            default: // newest
                sorted.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
        }
        
        container.innerHTML = sorted.map(seq => `
            <div class="sequence-card">
                <div class="sequence-header">
                    <div class="sequence-info">
                        <h3>Cas #${seq.test_case_id}</h3>
                        <div class="sequence-meta">
                            <span><i class="fas fa-clock"></i> ${this.formatDate(seq.generated_at)}</span>
                            <span><i class="fas fa-tachometer-alt"></i> ${seq.generation_time_ms}ms</span>
                            <span class="difficulty-badge difficulty-${seq.test_case.difficulty_level}">
                                ${this.getDifficultyLabel(seq.test_case.difficulty_level)}
                            </span>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="evaluator.showEvaluationModal(${seq.id})">
                        <i class="fas fa-clipboard-check me-2"></i>Évaluer
                    </button>
                </div>
                
                <div class="sequence-consultation">
                    ${this.escapeHtml(seq.test_case.consultation_text)}
                </div>
                
                <div class="sequence-preview">
                    <h4>Séquence générée:</h4>
                    <div class="sequence-steps">
                        ${seq.generated_sequence.slice(0, 3).map((step, i) => `
                            <div class="sequence-step">
                                <span class="step-number">${i + 1}</span>
                                <span>${step.traitement || 'N/A'} - ${step.dents?.join(', ') || 'N/A'}</span>
                            </div>
                        `).join('')}
                        ${seq.generated_sequence.length > 3 ? `
                            <div class="sequence-step">
                                <span class="step-number">...</span>
                                <span>+${seq.generated_sequence.length - 3} autres étapes</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    async loadEvaluatedSequences() {
        try {
            const response = await fetch('/sequences/evaluated');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.evaluatedSequences = data.evaluated_sequences;
                document.getElementById('evaluatedBadge').textContent = this.evaluatedSequences.length;
                this.renderEvaluatedSequences();
            }
        } catch (error) {
            console.error('Error loading evaluated sequences:', error);
        }
    }
    
    renderEvaluatedSequences() {
        const container = document.getElementById('evaluatedSequences');
        const filter = document.getElementById('evaluatedFilter').value;
        
        let filtered = [...this.evaluatedSequences];
        
        if (filter !== 'all') {
            filtered = filtered.filter(seq => {
                const score = seq.average_manual_score;
                switch(filter) {
                    case 'excellent': return score >= 9;
                    case 'good': return score >= 7 && score < 9;
                    case 'average': return score >= 5 && score < 7;
                    case 'poor': return score < 5;
                    default: return true;
                }
            });
        }
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-double fa-3x mb-3"></i>
                    <h3>Aucune séquence évaluée</h3>
                    <p>Les séquences évaluées apparaîtront ici</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filtered.map(seq => `
            <div class="sequence-card">
                <div class="sequence-header">
                    <div class="sequence-info">
                        <h3>Cas #${seq.test_case_id}</h3>
                        <div class="sequence-meta">
                            <span><i class="fas fa-clock"></i> ${this.formatDate(seq.generated_at)}</span>
                            <span><i class="fas fa-user-check"></i> ${seq.manual_evaluation_count} éval.</span>
                            ${seq.automatic_score ? `<span><i class="fas fa-robot"></i> Auto: ${seq.automatic_score}/10</span>` : ''}
                        </div>
                    </div>
                    <div class="overall-score ${this.getScoreClass(seq.average_manual_score)}">
                        ${seq.average_manual_score}/10
                    </div>
                </div>
                
                <div class="evaluation-scores">
                    ${seq.evaluations[0] ? this.renderEvaluationScores(seq.evaluations[0]) : ''}
                </div>
                
                ${seq.evaluations[0]?.feedback.strengths ? `
                    <div class="evaluation-feedback">
                        <h4>Points forts:</h4>
                        <p>${seq.evaluations[0].feedback.strengths}</p>
                    </div>
                ` : ''}
                
                <button class="btn btn-outline-primary btn-sm mt-3" onclick="evaluator.viewEvaluationDetails(${seq.id})">
                    <i class="fas fa-eye me-1"></i>Voir détails
                </button>
            </div>
        `).join('');
    }
    
    renderEvaluationScores(evaluation) {
        const scores = evaluation.scores;
        return `
            <div class="score-item">
                <div class="score-label">Précision clinique</div>
                <div class="score-value ${this.getScoreClass(scores.clinical_accuracy)}">${scores.clinical_accuracy || '-'}</div>
            </div>
            <div class="score-item">
                <div class="score-label">Logique</div>
                <div class="score-value ${this.getScoreClass(scores.sequencing_logic)}">${scores.sequencing_logic || '-'}</div>
            </div>
            <div class="score-item">
                <div class="score-label">Coût</div>
                <div class="score-value ${this.getScoreClass(scores.cost_appropriateness)}">${scores.cost_appropriateness || '-'}</div>
            </div>
            <div class="score-item">
                <div class="score-label">Sécurité</div>
                <div class="score-value ${this.getScoreClass(scores.safety)}">${scores.safety || '-'}</div>
            </div>
        `;
    }
    
    async loadAnalytics(days = 30) {
        try {
            const response = await fetch(`/analytics/performance?days=${days}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.updateAnalyticsDisplay(data.performance);
            }
            
            // Load overview for current metrics
            const overviewResponse = await fetch('/analytics/overview');
            const overviewData = await overviewResponse.json();
            
            if (overviewData.status === 'success') {
                this.updateMetricsDisplay(overviewData.analytics);
            }
            
            // Initialize charts
            this.initializeCharts();
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }
    
    updateMetricsDisplay(analytics) {
        // Update metric values
        document.getElementById('clinicalAccuracy').textContent = 
            analytics.average_scores.clinical_accuracy?.toFixed(1) || '-';
        document.getElementById('safetyScore').textContent = 
            analytics.average_scores.safety?.toFixed(1) || '-';
        
        // Mock data for now - would come from backend
        document.getElementById('costScore').textContent = '7.8';
        document.getElementById('completenessScore').textContent = '8.5';
        
        // Update issues list
        this.updateIssuesList();
    }
    
    updateIssuesList() {
        // Mock data - would come from backend analysis
        const issues = [
            {title: 'Séquences incomplètes', count: 12, severity: 'high'},
            {title: 'Coûts surestimés', count: 8, severity: 'medium'},
            {title: 'Ordre de traitement non optimal', count: 5, severity: 'low'}
        ];
        
        const container = document.getElementById('topIssues');
        container.innerHTML = issues.map(issue => `
            <div class="issue-item">
                <div class="issue-info">
                    <div class="issue-title">${issue.title}</div>
                    <div class="issue-count">${issue.count} occurrences</div>
                </div>
                <span class="issue-severity severity-${issue.severity}">
                    ${issue.severity.toUpperCase()}
                </span>
            </div>
        `).join('');
    }
    
    initializeCharts() {
        // Score evolution chart
        const evolutionCtx = document.getElementById('scoreEvolutionChart');
        if (evolutionCtx && !this.charts.evolution) {
            this.charts.evolution = new Chart(evolutionCtx, {
                type: 'line',
                data: {
                    labels: this.generateDateLabels(30),
                    datasets: [{
                        label: 'Score global',
                        data: this.generateMockData(30, 7, 9),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Précision clinique',
                        data: this.generateMockData(30, 7.5, 9.5),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#ccc'
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#888'
                            }
                        },
                        y: {
                            min: 0,
                            max: 10,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#888'
                            }
                        }
                    }
                }
            });
        }
        
        // Distribution chart
        const distributionCtx = document.getElementById('distributionChart');
        if (distributionCtx && !this.charts.distribution) {
            this.charts.distribution = new Chart(distributionCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Excellent (9-10)', 'Bon (7-8)', 'Moyen (5-6)', 'Faible (<5)'],
                    datasets: [{
                        data: [25, 45, 20, 10],
                        backgroundColor: [
                            'rgba(16, 185, 129, 0.8)',
                            'rgba(102, 126, 234, 0.8)',
                            'rgba(245, 158, 11, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#ccc',
                                padding: 20
                            }
                        }
                    }
                }
            });
        }
    }
    
    async generateSequence(testCaseId) {
        try {
            const btn = event.target;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Génération...';
            
            const response = await fetch('/generate-sequence', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    test_case_id: testCaseId,
                    auto_evaluate: false
                })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.showAlert('success', 'Séquence générée avec succès');
                this.switchTab('pending');
            } else {
                this.showAlert('error', 'Erreur lors de la génération');
            }
        } catch (error) {
            console.error('Error generating sequence:', error);
            this.showAlert('error', 'Erreur lors de la génération');
        } finally {
            const btn = event.target;
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-robot me-1"></i>Générer';
        }
    }
    
    showEvaluationModal(sequenceId) {
        const sequence = this.pendingSequences.find(s => s.id === sequenceId);
        if (!sequence) return;
        
        const modal = document.getElementById('evaluationModal');
        const container = modal.querySelector('.evaluation-container');
        
        container.innerHTML = `
            <div class="evaluation-left">
                <div class="evaluation-section">
                    <h4>Consultation</h4>
                    <div class="consultation-text">
                        ${this.escapeHtml(sequence.test_case.consultation_text)}
                    </div>
                </div>
                
                <div class="evaluation-section">
                    <h4>Séquence générée</h4>
                    <div class="sequence-steps">
                        ${sequence.generated_sequence.map((step, i) => `
                            <div class="sequence-step">
                                <span class="step-number">${i + 1}</span>
                                <div>
                                    <strong>${step.traitement || 'N/A'}</strong><br>
                                    Dents: ${step.dents?.join(', ') || 'N/A'}<br>
                                    Durée: ${step.duree || 'N/A'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                ${sequence.test_case.gold_standard_sequence?.length > 0 ? `
                    <div class="evaluation-section">
                        <h4>Séquence de référence</h4>
                        <div class="sequence-steps">
                            ${sequence.test_case.gold_standard_sequence.map((step, i) => `
                                <div class="sequence-step">
                                    <span class="step-number">${i + 1}</span>
                                    <span>${step}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="evaluation-right">
                <form id="evaluationForm" data-sequence-id="${sequenceId}">
                    <div class="evaluation-section">
                        <h4>Scores d'évaluation</h4>
                        <div class="scoring-grid">
                            ${this.renderScoreInput('clinical_accuracy', 'Précision clinique')}
                            ${this.renderScoreInput('sequencing_logic', 'Logique de séquençage')}
                            ${this.renderScoreInput('cost_appropriateness', 'Coût approprié')}
                            ${this.renderScoreInput('safety', 'Sécurité du patient')}
                            ${this.renderScoreInput('completeness', 'Complétude')}
                            ${this.renderScoreInput('overall', 'Score global', true)}
                        </div>
                    </div>
                    
                    <div class="evaluation-section">
                        <h4>Feedback détaillé</h4>
                        <div class="mb-3">
                            <label class="form-label">Points forts</label>
                            <textarea class="feedback-textarea" name="strengths" 
                                placeholder="Qu'est-ce qui était bien fait?"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Points faibles</label>
                            <textarea class="feedback-textarea" name="weaknesses" 
                                placeholder="Qu'est-ce qui pourrait être amélioré?"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Suggestions</label>
                            <textarea class="feedback-textarea" name="suggestions" 
                                placeholder="Recommandations spécifiques"></textarea>
                        </div>
                    </div>
                    
                    <div class="d-flex justify-content-end gap-2">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Annuler
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save me-2"></i>Enregistrer l'évaluation
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        // Setup form submission
        document.getElementById('evaluationForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitEvaluation(sequenceId);
        });
        
        // Setup score sliders
        this.setupScoreSliders();
        
        // Show modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
    
    renderScoreInput(name, label, isOverall = false) {
        return `
            <div class="score-input-group">
                <label>${label}</label>
                <div class="score-slider">
                    <input type="range" name="${name}" min="0" max="10" step="0.5" 
                        value="7" class="form-range ${isOverall ? 'overall-score' : ''}">
                    <span class="score-display">7</span>
                </div>
            </div>
        `;
    }
    
    setupScoreSliders() {
        document.querySelectorAll('.score-slider input[type="range"]').forEach(slider => {
            const display = slider.nextElementSibling;
            
            slider.addEventListener('input', (e) => {
                display.textContent = e.target.value;
                
                // Update overall score automatically (average of other scores)
                if (!slider.classList.contains('overall-score')) {
                    this.updateOverallScore();
                }
            });
        });
    }
    
    updateOverallScore() {
        const scores = [];
        document.querySelectorAll('.score-slider input[type="range"]:not(.overall-score)').forEach(slider => {
            scores.push(parseFloat(slider.value));
        });
        
        const average = scores.reduce((a, b) => a + b, 0) / scores.length;
        const overallSlider = document.querySelector('.overall-score');
        const overallDisplay = overallSlider.nextElementSibling;
        
        overallSlider.value = average.toFixed(1);
        overallDisplay.textContent = average.toFixed(1);
    }
    
    async submitEvaluation(sequenceId) {
        const form = document.getElementById('evaluationForm');
        const formData = new FormData(form);
        
        const evaluation = {
            generated_sequence_id: sequenceId,
            scores: {
                clinical_accuracy: parseFloat(formData.get('clinical_accuracy')),
                sequencing_logic: parseFloat(formData.get('sequencing_logic')),
                cost_appropriateness: parseFloat(formData.get('cost_appropriateness')),
                safety: parseFloat(formData.get('safety')),
                completeness: parseFloat(formData.get('completeness')),
                overall: parseFloat(formData.get('overall'))
            },
            feedback: {
                strengths: formData.get('strengths'),
                weaknesses: formData.get('weaknesses'),
                suggestions: formData.get('suggestions')
            }
        };
        
        try {
            const response = await fetch('/evaluate/manual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(evaluation)
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                bootstrap.Modal.getInstance(document.getElementById('evaluationModal')).hide();
                this.showAlert('success', 'Évaluation enregistrée avec succès');
                this.switchTab('evaluated');
            } else {
                this.showAlert('error', 'Erreur lors de l\'enregistrement');
            }
        } catch (error) {
            console.error('Error submitting evaluation:', error);
            this.showAlert('error', 'Erreur lors de l\'enregistrement');
        }
    }
    
    // Utility functions
    getDifficultyLabel(level) {
        const labels = {
            easy: 'Facile',
            medium: 'Moyen',
            hard: 'Difficile',
            expert: 'Expert'
        };
        return labels[level] || level;
    }
    
    getScoreClass(score) {
        if (score >= 8) return 'score-high';
        if (score >= 6) return 'score-medium';
        return 'score-low';
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'À l\'instant';
        if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)} h`;
        
        return date.toLocaleDateString('fr-FR');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    generateDateLabels(days) {
        const labels = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        }
        return labels;
    }
    
    generateMockData(points, min, max) {
        return Array.from({length: points}, () => 
            (Math.random() * (max - min) + min).toFixed(1)
        );
    }
    
    showAlert(type, message) {
        // Simple alert - could be replaced with a nicer notification system
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}

// Add test case modal functions
function showAddTestCaseModal() {
    const modal = new bootstrap.Modal(document.getElementById('addTestCaseModal'));
    modal.show();
}

function addSequenceItem() {
    const container = document.getElementById('goldStandardSequence');
    const index = container.children.length;
    
    const item = document.createElement('div');
    item.className = 'sequence-item';
    item.setAttribute('data-index', index);
    item.innerHTML = `
        <input type="text" class="form-control" placeholder="Traitement, dents, durée...">
        <button type="button" class="btn btn-sm btn-outline-danger remove-sequence" onclick="removeSequenceItem(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(item);
}

function removeSequenceItem(button) {
    button.parentElement.remove();
}

async function saveTestCase() {
    const form = document.getElementById('testCaseForm');
    
    // Collect gold standard sequence
    const goldStandardSequence = [];
    document.querySelectorAll('#goldStandardSequence input').forEach(input => {
        if (input.value.trim()) {
            goldStandardSequence.push(input.value.trim());
        }
    });
    
    // Parse categories
    const categoriesInput = document.getElementById('categories').value;
    const categories = categoriesInput ? categoriesInput.split(',').map(c => c.trim()).filter(c => c) : [];
    
    // Build patient context
    const patientContext = {};
    const age = document.getElementById('patientAge').value;
    const history = document.getElementById('medicalHistory').value;
    if (age) patientContext.age = parseInt(age);
    if (history) patientContext.medical_history = history;
    
    const testCase = {
        consultation_text: document.getElementById('consultationText').value,
        difficulty_level: document.getElementById('difficultyLevel').value,
        categories: categories,
        patient_context: patientContext,
        gold_standard_sequence: goldStandardSequence,
        notes: document.getElementById('notes').value
    };
    
    try {
        const response = await fetch('/test-cases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testCase)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            bootstrap.Modal.getInstance(document.getElementById('addTestCaseModal')).hide();
            document.getElementById('testCaseForm').reset();
            evaluator.showAlert('success', 'Cas de test créé avec succès');
            evaluator.loadTestCases();
        } else {
            evaluator.showAlert('error', 'Erreur lors de la création');
        }
    } catch (error) {
        console.error('Error saving test case:', error);
        evaluator.showAlert('error', 'Erreur lors de la création');
    }
}

// Initialize on page load
let evaluator;
document.addEventListener('DOMContentLoaded', () => {
    evaluator = new Evaluator();
});