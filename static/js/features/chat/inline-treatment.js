// Inline Treatment Display Module
// Handles displaying treatment plans inline within chat messages

export class InlineTreatmentDisplay {
    constructor() {
        this.currentTreatmentPlan = null;
        this.activeTab = 'sequence';
        this.lastWindowWidth = window.innerWidth;
        
        // Handle window resize for mobile/desktop switch
        this.handleResize = this.debounce(() => {
            const currentWidth = window.innerWidth;
            const wasMobile = this.lastWindowWidth < 768;
            const isMobile = currentWidth < 768;
            
            // Only refresh if we crossed the mobile/desktop boundary
            if (wasMobile !== isMobile && this.currentContainer) {
                this.lastWindowWidth = currentWidth;
                this.refreshTable();
            }
        }, 250);
        
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleResize);
        
        this.initializeStyles();
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    initializeStyles() {
        // Add CSS for inline treatment display if not already present
        if (!document.getElementById('inline-treatment-styles')) {
            const style = document.createElement('style');
            style.id = 'inline-treatment-styles';
            style.textContent = `
                .inline-treatment-container {
                    margin: 20px 0;
                    background: var(--card-bg);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                }
                
                .inline-treatment-tabs {
                    display: flex;
                    background: var(--header-bg);
                    border-bottom: 1px solid var(--border-color);
                }
                
                .inline-treatment-tab {
                    flex: 1;
                    padding: 12px 20px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-secondary);
                    transition: all 0.2s ease;
                    position: relative;
                }
                
                .inline-treatment-tab:hover {
                    background: rgba(255, 255, 255, 0.05);
                }
                
                .inline-treatment-tab.active {
                    color: var(--primary);
                }
                
                .inline-treatment-tab.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: var(--primary);
                }
                
                .inline-treatment-content {
                    padding: 20px;
                    max-height: 600px;
                    overflow-y: auto;
                }
                
                .inline-treatment-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--border-color);
                }
                
                .inline-toolbar-group {
                    display: flex;
                    gap: 10px;
                }
                
                .inline-toolbar-btn {
                    padding: 6px 12px;
                    background: var(--secondary-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    color: var(--text-primary);
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                
                .inline-toolbar-btn:hover {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }
                
                .inline-toolbar-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .inline-treatment-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                .inline-treatment-table th,
                .inline-treatment-table td {
                    padding: 10px 12px;
                    text-align: left;
                    border-bottom: 1px solid var(--border-color);
                }
                
                .inline-treatment-table th {
                    background: var(--header-bg);
                    font-weight: 600;
                    font-size: 13px;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .inline-treatment-table td {
                    font-size: 14px;
                }
                
                .inline-treatment-table .editable {
                    cursor: text;
                    padding: 4px 6px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                
                .inline-treatment-table .editable:hover {
                    background: rgba(255, 255, 255, 0.05);
                }
                
                .inline-treatment-table .editable:focus {
                    background: rgba(255, 255, 255, 0.1);
                    outline: 2px solid var(--primary);
                    outline-offset: -2px;
                }
                
                .inline-notes-content {
                    white-space: pre-wrap;
                    line-height: 1.6;
                }
                
                .inline-financial-summary {
                    background: rgba(255, 255, 255, 0.05);
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                }
                
                .inline-financial-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                
                .inline-financial-total {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--primary);
                    border-top: 2px solid var(--border-color);
                    padding-top: 10px;
                    margin-top: 10px;
                }
                
                /* Ensure chat area is wider */
                .chat-container {
                    max-width: 1200px !important;
                }
                
                .chat-messages {
                    max-width: 100% !important;
                }
                
                .message {
                    max-width: 100% !important;
                }
                
                .message.assistant .message-content {
                    max-width: 100% !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    displayTreatmentPlan(plan, references = [], messageElement) {
        this.currentTreatmentPlan = JSON.parse(JSON.stringify(plan));
        
        // Create inline treatment container
        const container = document.createElement('div');
        container.className = 'inline-treatment-container';
        container.innerHTML = this.generateTreatmentHTML(plan, references);
        
        // Append to the message element
        messageElement.appendChild(container);
        
        // Initialize event listeners
        this.initializeEventListeners(container);
        
        // Store reference to container for updates
        this.currentContainer = container;
    }

    generateTreatmentHTML(plan, references) {
        const isApproved = window.currentConversation && window.currentConversation.treatment_plan_approved;
        const isMobile = window.innerWidth < 768;
        
        // Generate unique ID for this treatment instance
        const instanceId = 'treatment-' + Date.now();
        
        return `
            ${isMobile ? `
                <!-- Mobile Dropdown for Tabs -->
                <div class="mobile-treatment-dropdown">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
                        <i class="fas fa-layer-group"></i>
                        <span>Changer de vue:</span>
                    </label>
                    <select class="treatment-dropdown-select" id="${instanceId}-select" onchange="window.inlineTreatment.switchTabMobile('${instanceId}', this.value)">
                        <option value="sequence">📋 Séquence de traitement</option>
                        <option value="references">📚 Références RAG</option>
                    </select>
                </div>
            ` : `
                <!-- Desktop Tabs -->
                <div class="inline-treatment-tabs">
                    <button class="inline-treatment-tab active" data-tab="sequence" onclick="window.inlineTreatment.switchTab('sequence')">
                        <i class="fas fa-list-ol"></i> Séquence
                    </button>
                    <button class="inline-treatment-tab" data-tab="references" onclick="window.inlineTreatment.switchTab('references')">
                        <i class="fas fa-book"></i> Références
                    </button>
                </div>
            `}
            
            <div class="inline-treatment-content" data-instance="${instanceId}">
                <div class="inline-tab-content" id="inline-sequence-tab" style="display: block;">
                    ${this.generateSequenceContent(plan, isApproved)}
                </div>
                
                <div class="inline-tab-content" id="inline-references-tab" style="display: none;">
                    ${this.generateReferencesContent(plan, references)}
                </div>
            </div>
        `;
    }

    generateSequenceContent(plan, isApproved) {
        let html = '';
        
        if (plan.consultation_text) {
            html += `<div class="consultation-text">${this.escapeHtml(plan.consultation_text)}</div>`;
        }
        
        // Toolbar
        html += `
            <div class="inline-treatment-toolbar">
                <div class="inline-toolbar-group">
                    <button class="inline-toolbar-btn" onclick="window.inlineTreatment.addNewRow()" title="Ajouter une ligne">
                        <i class="fas fa-plus"></i> Ajouter
                    </button>
                    <button class="inline-toolbar-btn merge-selected-btn" onclick="window.inlineTreatment.mergeSelectedRows()" title="Fusionner les lignes sélectionnées" disabled>
                        <i class="fas fa-compress-arrows-alt"></i> Fusionner
                    </button>
                </div>
                
                <div class="inline-toolbar-group">
                    <button class="inline-toolbar-btn" onclick="window.inlineTreatment.exportTreatmentPlan()" title="Exporter le plan">
                        <i class="fas fa-download"></i> Exporter
                    </button>
                    ${!isApproved ? `
                        <button class="inline-toolbar-btn primary" onclick="window.scrollToApprovalSection()" title="Approuver le plan">
                            <i class="fas fa-check-circle"></i> ${window.currentConversation && window.currentConversation.treatment_plan_approved ? 'Voir approbation' : 'Approuver'}
                        </button>
                    ` : `
                        <span class="approved-badge">
                            <i class="fas fa-check-circle"></i> Plan approuvé
                        </span>
                    `}
                </div>
            </div>
        `;
        
        // Check if mobile
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            // Mobile Card View
            html += `
                <div class="mobile-treatment-cards" id="mobile-treatmentCards">
                    ${(plan.treatment_sequence || []).map((appointment, index) => 
                        this.createTreatmentCard(appointment, index)
                    ).join('')}
                </div>
            `;
        } else {
            // Desktop Table View
            html += `
                <table class="inline-treatment-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">
                                <input type="checkbox" id="inline-selectAllRows" onchange="window.inlineTreatment.toggleSelectAll()">
                            </th>
                            <th style="width: 60px;">RDV</th>
                            <th>Traitement</th>
                            <th style="width: 80px;">Durée</th>
                            <th style="width: 100px;">Délai</th>
                            <th style="width: 60px;">Dr</th>
                            <th style="width: 150px;">Remarque</th>
                            <th style="width: 80px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="inline-treatmentTableBody">
                        ${(plan.treatment_sequence || []).map((appointment, index) => 
                            this.createTreatmentRow(appointment, index)
                        ).join('')}
                    </tbody>
                </table>
            `;
        }
        
        return html;
    }

    // REMOVED: Optimized content functionality
    generateOptimizedContent(plan) {
        return '<p class="no-data">Fonctionnalité supprimée</p>';
    }
    
    /* Original code commented out:
    generateOptimizedContent(plan) {
        if (!plan.optimized_versions || plan.optimized_versions.length === 0) {
            return '<p class="no-data">Aucune version optimisée disponible. Cliquez sur "Optimiser" pour générer des alternatives.</p>';
        }
        
        let html = '<div class="optimized-versions">';
        
        plan.optimized_versions.forEach((version, index) => {
            html += `
                <div class="optimization-version">
                    <h4>${this.escapeHtml(version.name)}</h4>
                    <div class="inline-financial-summary">
                        <div class="inline-financial-row">
                            <span>Coût total:</span>
                            <span>${version.total_cost} CHF</span>
                        </div>
                        <div class="inline-financial-row">
                            <span>Économie:</span>
                            <span class="savings">${version.savings} CHF</span>
                        </div>
                    </div>
                    <p>${this.escapeHtml(version.description)}</p>
                    <button class="inline-toolbar-btn" onclick="window.inlineTreatment.applyOptimization(${index})">
                        <i class="fas fa-check"></i> Appliquer cette version
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    */

    generateReferencesContent(plan, references) {
        let html = '<div class="inline-references-content">';
        
        if (references && references.length > 0) {
            html += `
                <h3 style="margin-bottom: 20px;">📚 Références utilisées</h3>
                <div class="references-grid">
            `;
            
            // Group references by type
            const clinicalCases = references.filter(ref => ref.type === 'clinical_case');
            const idealSequences = references.filter(ref => ref.type === 'ideal_sequence');
            const knowledge = references.filter(ref => ref.type === 'knowledge');
            
            if (clinicalCases.length > 0) {
                html += `
                    <div class="reference-section">
                        <h4><i class="fas fa-hospital"></i> Cas cliniques similaires</h4>
                        ${clinicalCases.map(ref => this.createReferenceCard(ref)).join('')}
                    </div>
                `;
            }
            
            if (idealSequences.length > 0) {
                html += `
                    <div class="reference-section">
                        <h4><i class="fas fa-clipboard-list"></i> Séquences idéales</h4>
                        ${idealSequences.map(ref => this.createReferenceCard(ref)).join('')}
                    </div>
                `;
            }
            
            if (knowledge.length > 0) {
                html += `
                    <div class="reference-section">
                        <h4><i class="fas fa-book"></i> Base de connaissances</h4>
                        ${knowledge.map(ref => this.createReferenceCard(ref)).join('')}
                    </div>
                `;
            }
            
            html += '</div>';
        } else {
            html += '<p class="no-data">Aucune référence RAG n\'a été utilisée pour ce plan de traitement.</p>';
        }
        
        html += '</div>';
        return html;
    }
    
    createReferenceCard(ref) {
        const score = Math.round(ref.similarity_score * 100);
        const scoreClass = score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low';
        const typeIcon = ref.type === 'clinical_case' ? '🏥' : ref.type === 'ideal_sequence' ? '📋' : '📚';
        
        // Build score section with gauge
        const scoreSection = `
            <div class="rag-source-score">
                <div class="score-label">Similarité:</div>
                <div class="score-bar-container">
                    <div class="score-bar score-${scoreClass}" style="width: ${score}%"></div>
                </div>
                <span class="score-percentage">${score}%</span>
            </div>
        `;
        
        return `
            <div class="rag-source-item clickable" onclick='window.showRagSourceDetail && window.showRagSourceDetail(${JSON.stringify(ref).replace(/'/g, '&apos;')})'>
                <div class="rag-source-header">
                    <span class="rag-source-type">${typeIcon}</span>
                    <span class="rag-source-title">${this.escapeHtml(ref.title)}</span>
                </div>
                ${scoreSection}
                <div class="rag-source-meta">
                    <span class="source-type">${ref.type === 'clinical_case' ? 'Cas clinique' : ref.type === 'ideal_sequence' ? 'Séquence idéale' : 'Base de connaissances'}</span>
                    ${ref.categories?.length > 0 ? `<span class="source-categories">${ref.categories.join(', ')}</span>` : ''}
                </div>
                <div class="click-indicator">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
    }
    
    // REMOVED: Financial analysis functionality
    generateFinanceContent(plan) {
        return '<p class="no-data">Fonctionnalité supprimée</p>';
    }
    
    /* Original code commented out:
    generateFinanceContent(plan) {
        let html = '<div class="inline-finance-content">';
        
        // Calculate financials using pricing config
        const financials = window.pricingConfig && window.pricingConfig.calculateSequenceFinancials ? 
            window.pricingConfig.calculateSequenceFinancials(plan.treatment_sequence) : 
            null;
            
        if (!financials || !financials.summary) {
            html += '<p class="no-data">Analyse financière non disponible. Vérifiez la configuration des prix.</p>';
            html += '</div>';
            return html;
        }
        
        const summary = financials.summary;
        const formatCurrency = window.pricingConfig.formatCurrency || ((val) => `${val} CHF`);
        
        // Store original sequence for reset
        if (!window.originalTreatmentSequence) {
            window.originalTreatmentSequence = JSON.parse(JSON.stringify(plan.treatment_sequence));
        }
        
        html += `
            <div class="financial-analysis-section">
                <h4 class="financial-title">
                    <i class="fas fa-chart-line"></i> Analyse Financière
                </h4>
                
                <!-- Financial Optimization Slider -->
                <div class="financial-optimizer">
                    <div class="optimizer-header">
                        <h5><i class="fas fa-sliders-h"></i> Optimisation financière</h5>
                        <span class="coming-soon-badge">À venir</span>
                    </div>
                    <div class="optimizer-slider-container">
                        <div class="slider-labels">
                            <span class="slider-label">
                                <i class="fas fa-piggy-bank"></i> Économique
                            </span>
                            <span class="slider-label">
                                <i class="fas fa-balance-scale"></i> Équilibré
                            </span>
                            <span class="slider-label">
                                <i class="fas fa-gem"></i> Premium
                            </span>
                        </div>
                        <input type="range" id="inline-financialOptimizer" min="0" max="100" value="100" step="10"
                               oninput="window.inlineTreatment.optimizeFinancially(this.value)">
                        <div class="optimizer-info">
                            <div class="optimizer-value" id="inline-optimizerValue">
                                <span class="value-label">Mode actuel:</span>
                                <span class="value-text">Premium (100%)</span>
                            </div>
                            <div class="optimizer-impact" id="inline-optimizerImpact" style="display: none;">
                                <span class="impact-label">Impact:</span>
                                <span class="impact-value">-</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Summary Cards -->
                <div class="financial-summary-cards">
                    <div class="financial-card revenue-card">
                        <div class="card-icon">
                            <i class="fas fa-coins"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-label">Chiffre d'affaires total</div>
                            <div class="card-value">${formatCurrency(summary.totalRevenue)}</div>
                            <div class="card-subtitle">${formatCurrency(summary.monthlyRevenue)}/mois</div>
                        </div>
                    </div>
                    
                    <div class="financial-card costs-card">
                        <div class="card-icon">
                            <i class="fas fa-receipt"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-label">Coûts totaux</div>
                            <div class="card-value">${formatCurrency(summary.totalCosts)}</div>
                            <div class="card-subtitle">${Math.round(summary.totalCosts / summary.totalRevenue * 100)}% du CA</div>
                        </div>
                    </div>
                    
                    <div class="financial-card profit-card">
                        <div class="card-icon">
                            <i class="fas fa-chart-pie"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-label">Bénéfice net</div>
                            <div class="card-value">${formatCurrency(summary.totalProfit)}</div>
                            <div class="card-subtitle">Marge: ${Math.round(summary.overallMargin * 100)}%</div>
                        </div>
                    </div>
                </div>
                
                <!-- Charts Container -->
                <div class="financial-charts">
                    <div class="chart-container">
                        <canvas id="inline-profitBreakdownChart"></canvas>
                    </div>
                    <div class="chart-container">
                        <canvas id="inline-costDistributionChart"></canvas>
                    </div>
                </div>
                
                <!-- Detailed Breakdown -->
                <div class="financial-breakdown">
                    <h5>Détail par rendez-vous</h5>
                    <div class="breakdown-table">
                        ${this.generateBreakdownTable(financials.breakdown)}
                    </div>
                </div>
                
                <!-- Performance Metrics -->
                <div class="performance-metrics">
                    <div class="metric">
                        <i class="fas fa-clock"></i>
                        <span>${Math.round(summary.totalDuration / 60)}h de traitement</span>
                    </div>
                    <div class="metric">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${summary.appointmentCount} rendez-vous</span>
                    </div>
                    <div class="metric">
                        <i class="fas fa-hourglass-half"></i>
                        <span>${summary.treatmentMonths} mois de traitement</span>
                    </div>
                    <div class="metric">
                        <i class="fas fa-euro-sign"></i>
                        <span>${formatCurrency(summary.totalRevenue / (summary.totalDuration / 60))}/heure</span>
                    </div>
                </div>
            </div>
        `;
        
        html += '</div>';
        
        // Initialize charts after content is added to DOM
        setTimeout(() => this.initializeFinancialCharts(financials), 100);
        
        return html;
    }
    */
    
    generateBreakdownTable(breakdown) {
        const formatCurrency = window.pricingConfig.formatCurrency || ((val) => `${val} CHF`);
        let html = '<table class="breakdown-table-content">';
        html += '<thead><tr><th>RDV</th><th>Procédure</th><th>Qté</th><th>CA</th><th>Coûts</th><th>Marge</th></tr></thead>';
        html += '<tbody>';
        
        if (breakdown && breakdown.length > 0) {
            breakdown.forEach(item => {
                const marginClass = item.margin > 0.6 ? 'high-margin' : item.margin > 0.4 ? 'medium-margin' : 'low-margin';
                html += `
                    <tr>
                        <td>${item.appointment}</td>
                        <td>${this.escapeHtml(item.procedure)}</td>
                        <td>${item.quantity}</td>
                        <td>${formatCurrency(item.revenue)}</td>
                        <td>${formatCurrency(item.costs)}</td>
                        <td class="${marginClass}">${Math.round(item.margin * 100)}%</td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table>';
        return html;
    }

    createTreatmentRow(appointment, index) {
        return `
            <tr data-index="${index}">
                <td>
                    <input type="checkbox" class="row-checkbox" onchange="window.inlineTreatment.updateSelectedRows()">
                </td>
                <td class="editable" contenteditable="true" data-field="rdv">${appointment.rdv || index + 1}</td>
                <td class="editable" contenteditable="true" data-field="traitement">${this.escapeHtml(appointment.traitement || '')}</td>
                <td class="editable" contenteditable="true" data-field="duree">${this.escapeHtml(appointment.duree || '-')}</td>
                <td class="editable" contenteditable="true" data-field="delai">${this.escapeHtml(appointment.delai || '-')}</td>
                <td class="editable" contenteditable="true" data-field="dr">${this.escapeHtml(appointment.dr || '-')}</td>
                <td class="editable" contenteditable="true" data-field="remarque">${this.escapeHtml(appointment.remarque || '-')}</td>
                <td>
                    <button class="action-btn delete-btn" onclick="window.inlineTreatment.deleteRow(${index})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }
    
    createTreatmentCard(appointment, index) {
        return `
            <div class="treatment-card" data-index="${index}">
                <div class="treatment-card-header">
                    <div class="treatment-card-rdv">RDV ${appointment.rdv || index + 1}</div>
                    <div class="treatment-card-actions">
                        <input type="checkbox" class="card-checkbox" onchange="window.inlineTreatment.updateSelectedRows()">
                        <button class="action-btn delete-btn" onclick="window.inlineTreatment.deleteRow(${index})" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="treatment-card-field">
                    <div class="treatment-card-label">Traitement</div>
                    <div class="treatment-card-value editable" contenteditable="true" data-field="traitement" data-index="${index}">
                        ${this.escapeHtml(appointment.traitement || '')}
                    </div>
                </div>
                
                <div class="treatment-card-field">
                    <div class="treatment-card-label">Durée</div>
                    <div class="treatment-card-value editable" contenteditable="true" data-field="duree" data-index="${index}">
                        ${this.escapeHtml(appointment.duree || '-')}
                    </div>
                </div>
                
                <div class="treatment-card-field">
                    <div class="treatment-card-label">Délai</div>
                    <div class="treatment-card-value editable" contenteditable="true" data-field="delai" data-index="${index}">
                        ${this.escapeHtml(appointment.delai || '-')}
                    </div>
                </div>
                
                <div class="treatment-card-field">
                    <div class="treatment-card-label">Docteur</div>
                    <div class="treatment-card-value editable" contenteditable="true" data-field="dr" data-index="${index}">
                        ${this.escapeHtml(appointment.dr || '-')}
                    </div>
                </div>
                
                <div class="treatment-card-field">
                    <div class="treatment-card-label">Remarque</div>
                    <div class="treatment-card-value editable" contenteditable="true" data-field="remarque" data-index="${index}">
                        ${this.escapeHtml(appointment.remarque || '-')}
                    </div>
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        // Update tab buttons
        this.currentContainer.querySelectorAll('.inline-treatment-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update tab content
        this.currentContainer.querySelectorAll('.inline-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const activeContent = this.currentContainer.querySelector(`#inline-${tabName}-tab`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }
        
        this.activeTab = tabName;
    }
    
    switchTabMobile(instanceId, tabName) {
        // Find the specific container
        const container = document.querySelector(`[data-instance="${instanceId}"]`);
        if (!container) return;
        
        // Update tab content
        container.querySelectorAll('.inline-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const activeContent = container.querySelector(`#inline-${tabName}-tab`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }
        
        this.activeTab = tabName;
    }

    addNewRow() {
        const newAppointment = {
            rdv: this.currentTreatmentPlan.treatment_sequence.length + 1,
            traitement: 'Nouveau traitement',
            duree: '30 min',
            delai: '0',
            dr: '-',
            remarque: '-'
        };
        
        this.currentTreatmentPlan.treatment_sequence.push(newAppointment);
        this.refreshTable();
    }

    deleteRow(index) {
        this.currentTreatmentPlan.treatment_sequence.splice(index, 1);
        
        // Renumber appointments
        this.currentTreatmentPlan.treatment_sequence.forEach((apt, i) => {
            apt.rdv = i + 1;
        });
        
        this.refreshTable();
    }

    toggleSelectAll() {
        const selectAll = this.currentContainer.querySelector('#inline-selectAllRows');
        const checkboxes = this.currentContainer.querySelectorAll('.row-checkbox');
        
        checkboxes.forEach(cb => {
            cb.checked = selectAll.checked;
        });
        
        this.updateSelectedRows();
    }

    updateSelectedRows() {
        // Support both desktop (.row-checkbox) and mobile (.card-checkbox) checkboxes
        const checkboxSelector = window.innerWidth < 768 ? '.card-checkbox:checked' : '.row-checkbox:checked';
        const selected = this.currentContainer.querySelectorAll(checkboxSelector).length;
        const mergeBtn = this.currentContainer.querySelector('.merge-selected-btn');
        
        if (mergeBtn) {
            mergeBtn.disabled = selected < 2;
        }
    }

    mergeSelectedRows() {
        const isMobile = window.innerWidth < 768;
        const checkboxSelector = isMobile ? '.card-checkbox:checked' : '.row-checkbox:checked';
        const selectedRows = Array.from(this.currentContainer.querySelectorAll(checkboxSelector))
            .map(cb => parseInt(cb.closest(isMobile ? '.treatment-card' : 'tr').dataset.index));
        
        if (selectedRows.length < 2) return;
        
        // Sort indices in reverse order to avoid index shifting issues
        selectedRows.sort((a, b) => b - a);
        
        // Merge treatments
        const mergedTreatments = [];
        let totalDuration = 0;
        
        selectedRows.forEach(index => {
            const apt = this.currentTreatmentPlan.treatment_sequence[index];
            mergedTreatments.push(apt.traitement);
            
            // Parse duration (assume format like "30 min" or "1h30")
            const duration = apt.duree || '0';
            const minutes = this.parseDuration(duration);
            totalDuration += minutes;
        });
        
        // Create merged appointment
        const mergedAppointment = {
            rdv: Math.min(...selectedRows) + 1,
            traitement: mergedTreatments.reverse().join(' + '),
            duree: this.formatDuration(totalDuration),
            delai: this.currentTreatmentPlan.treatment_sequence[selectedRows[selectedRows.length - 1]].delai,
            dr: this.currentTreatmentPlan.treatment_sequence[selectedRows[selectedRows.length - 1]].dr,
            remarque: 'Séances fusionnées'
        };
        
        // Remove selected rows and insert merged
        selectedRows.forEach(index => {
            this.currentTreatmentPlan.treatment_sequence.splice(index, 1);
        });
        
        this.currentTreatmentPlan.treatment_sequence.splice(
            Math.min(...selectedRows), 
            0, 
            mergedAppointment
        );
        
        // Renumber appointments
        this.currentTreatmentPlan.treatment_sequence.forEach((apt, i) => {
            apt.rdv_number = i + 1;
        });
        
        this.refreshTable();
    }

    // REMOVED: Optimization functionality
    async optimizeTreatmentPlan() {
        window.showNotification('info', 'Fonctionnalité supprimée');
        return;
    }
    
    /* Original code commented out:
    async optimizeTreatmentPlan() {
        // Call the optimization API
        try {
            const response = await fetch('/api/ai/optimize-treatment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    treatment_plan: this.currentTreatmentPlan
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success' && result.optimized_versions) {
                this.currentTreatmentPlan.optimized_versions = result.optimized_versions;
                
                // Switch to optimized tab
                this.switchTab('optimized');
                
                // Refresh the optimized content
                const optimizedContent = this.currentContainer.querySelector('#inline-optimized-tab');
                optimizedContent.innerHTML = this.generateOptimizedContent(this.currentTreatmentPlan);
            }
        } catch (error) {
            console.error('Error optimizing treatment plan:', error);
            window.showNotification('error', 'Erreur lors de l\'optimisation');
        }
    }
    */

    async approveTreatmentPlan() {
        if (!window.currentConversationId) {
            window.showNotification('error', 'Aucune conversation active');
            return;
        }
        
        try {
            const response = await fetch(`/api/user/conversations/${window.currentConversationId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                window.showNotification('success', 'Plan de traitement approuvé avec succès');
                
                // Update the current conversation data
                window.currentConversation = result.conversation;
                
                // Refresh the treatment display
                this.refreshTable();
                
                // Reload conversations to update the sidebar
                if (window.loadConversations) {
                    await window.loadConversations();
                }
            }
        } catch (error) {
            console.error('Error approving treatment plan:', error);
            window.showNotification('error', 'Erreur lors de l\'approbation du plan');
        }
    }

    exportTreatmentPlan() {
        const dataStr = JSON.stringify(this.currentTreatmentPlan, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `plan-traitement-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    applyOptimization(versionIndex) {
        const optimizedVersion = this.currentTreatmentPlan.optimized_versions[versionIndex];
        if (optimizedVersion && optimizedVersion.sequence) {
            this.currentTreatmentPlan.treatment_sequence = optimizedVersion.sequence;
            
            // Switch back to sequence tab
            this.switchTab('sequence');
            
            // Refresh the table
            this.refreshTable();
            
            window.showNotification('success', 'Version optimisée appliquée');
        }
    }

    refreshTable() {
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            // Refresh mobile cards
            const cardsContainer = this.currentContainer.querySelector('#mobile-treatmentCards');
            if (cardsContainer) {
                cardsContainer.innerHTML = '';
                
                this.currentTreatmentPlan.treatment_sequence.forEach((appointment, index) => {
                    cardsContainer.insertAdjacentHTML('beforeend', this.createTreatmentCard(appointment, index));
                });
                
                // Re-add event listeners for cards
                this.initializeEditListenersForCards(cardsContainer);
            }
        } else {
            // Refresh desktop table
            const tbody = this.currentContainer.querySelector('#inline-treatmentTableBody');
            if (tbody) {
                tbody.innerHTML = '';
                
                this.currentTreatmentPlan.treatment_sequence.forEach((appointment, index) => {
                    tbody.insertAdjacentHTML('beforeend', this.createTreatmentRow(appointment, index));
                });
                
                // Re-add event listeners
                this.initializeEditListeners(tbody);
                
                // Reset select all checkbox
                const selectAll = this.currentContainer.querySelector('#inline-selectAllRows');
                if (selectAll) selectAll.checked = false;
            }
        }
        
        // Update merge button state
        this.updateSelectedRows();
    }

    initializeEventListeners(container) {
        // Initialize edit listeners for the table
        const tbody = container.querySelector('#inline-treatmentTableBody');
        if (tbody) {
            this.initializeEditListeners(tbody);
        }
    }

    initializeEditListeners(tbody) {
        tbody.querySelectorAll('.editable').forEach(cell => {
            cell.addEventListener('blur', () => {
                const field = cell.getAttribute('data-field');
                const rowIndex = parseInt(cell.closest('tr').getAttribute('data-index'));
                const value = cell.textContent.trim();
                
                if (this.currentTreatmentPlan.treatment_sequence[rowIndex]) {
                    this.currentTreatmentPlan.treatment_sequence[rowIndex][field] = value || '-';
                }
            });
            
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    cell.blur();
                }
            });
        });
    }
    
    initializeEditListenersForCards(container) {
        container.querySelectorAll('.editable').forEach(cell => {
            cell.addEventListener('blur', () => {
                const field = cell.getAttribute('data-field');
                const index = parseInt(cell.getAttribute('data-index'));
                const value = cell.textContent.trim();
                
                if (this.currentTreatmentPlan.treatment_sequence[index]) {
                    this.currentTreatmentPlan.treatment_sequence[index][field] = value || '-';
                }
            });
            
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    cell.blur();
                }
            });
        });
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    parseDuration(duration) {
        if (!duration) return 0;
        
        const hourMatch = duration.match(/(\d+)h/);
        const minMatch = duration.match(/(\d+)\s*min/);
        
        let totalMinutes = 0;
        if (hourMatch) totalMinutes += parseInt(hourMatch[1]) * 60;
        if (minMatch) totalMinutes += parseInt(minMatch[1]);
        
        return totalMinutes;
    }

    formatDuration(minutes) {
        if (minutes < 60) {
            return `${minutes} min`;
        }
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (mins === 0) {
            return `${hours}h`;
        }
        
        return `${hours}h${mins}`;
    }
    
    calculateTotalCost(plan) {
        // Simple estimation based on treatment types
        // This would normally come from the backend
        return plan.treatment_sequence.length * 250; // Default estimate
    }
    
    calculateTotalDuration(plan) {
        let totalMinutes = 0;
        plan.treatment_sequence.forEach(apt => {
            const minutes = this.parseDuration(apt.duree);
            totalMinutes += minutes;
        });
        return this.formatDuration(totalMinutes);
    }
    
    formatCategory(category) {
        const categoryMap = {
            'materials': 'Matériaux',
            'labor': 'Main d\'œuvre',
            'lab': 'Laboratoire',
            'other': 'Autres'
        };
        return categoryMap[category] || category;
    }
    
    async requestDetailedFinancialAnalysis() {
        // This would call the backend to get detailed financial analysis
        window.showNotification('info', 'Analyse financière détaillée en cours de développement');
    }
    
    
    // REMOVED: Financial optimization functionality
    optimizeFinancially(value) {
        // Function removed
    }
    
    // REMOVED: Financial charts functionality
    initializeFinancialCharts(financials) {
        // Function removed
        return;
    }
    
    /* Original code commented out:
    initializeFinancialCharts(financials) {
        if (!window.Chart) return;
        
        const summary = financials.summary;
        const formatCurrency = window.pricingConfig.formatCurrency || ((val) => `${val} CHF`);
        
        // Profit Breakdown Chart
        const profitCanvas = document.getElementById('inline-profitBreakdownChart');
        if (profitCanvas) {
            const profitCtx = profitCanvas.getContext('2d');
            new Chart(profitCtx, {
                type: 'bar',
                data: {
                    labels: ['CA', 'Coûts', 'Bénéfice'],
                    datasets: [{
                        data: [summary.totalRevenue, summary.totalCosts, summary.totalProfit],
                        backgroundColor: ['#10b981', '#ef4444', '#667eea'],
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.6)',
                                callback: function(value) {
                                    return formatCurrency(value);
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.6)'
                            }
                        }
                    }
                }
            });
        }
        
        // Cost Distribution Chart
        const costCanvas = document.getElementById('inline-costDistributionChart');
        if (costCanvas) {
            const costCtx = costCanvas.getContext('2d');
            
            // Calculate cost distribution
            const costData = {
                'Main d\'œuvre': summary.laborCosts || summary.totalCosts * 0.5,
                'Matériaux': summary.materialCosts || summary.totalCosts * 0.25,
                'Laboratoire': summary.labCosts || summary.totalCosts * 0.15,
                'Frais généraux': summary.overheadCosts || summary.totalCosts * 0.1
            };
            
            new Chart(costCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(costData),
                    datasets: [{
                        data: Object.values(costData),
                        backgroundColor: ['#667eea', '#a78bfa', '#c4b5fd', '#e9d5ff'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'rgba(255, 255, 255, 0.8)',
                                padding: 15,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = formatCurrency(context.parsed);
                                    const percentage = Math.round((context.parsed / summary.totalCosts) * 100);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    */
}

// Create and export instance
export const inlineTreatment = new InlineTreatmentDisplay();

// Make it globally available for onclick handlers
window.inlineTreatment = inlineTreatment;