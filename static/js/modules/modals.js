// Modals Module
// Handles all modal dialogs in the application

import { DOMUtils } from './dom-utils.js';

class ModalManager {
    constructor() {
        this.activeModal = null;
        this.init();
    }
    
    init() {
        // Set up global click handler for modal backgrounds
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && e.target === this.activeModal) {
                this.closeModal();
            }
        });
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.closeModal();
            }
        });
    }
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            this.activeModal = modal;
            DOMUtils.show(modal, 'flex');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeModal() {
        if (this.activeModal) {
            DOMUtils.hide(this.activeModal);
            this.activeModal = null;
            document.body.style.overflow = '';
        }
    }
    
    showReferenceModal(reference) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('referenceModal');
        if (!modal) {
            modal = this.createReferenceModal();
        }
        
        // Update content
        this.updateReferenceModalContent(modal, reference);
        
        // Show modal
        this.showModal('referenceModal');
    }
    
    createReferenceModal() {
        const modal = DOMUtils.createElement('div', {
            className: 'modal',
            attributes: { id: 'referenceModal' }
        });
        
        modal.innerHTML = `
            <div class="modal-content reference-modal">
                <div class="modal-header">
                    <h3 id="referenceTitle"></h3>
                    <button class="icon-btn" onclick="modalManager.closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" id="referenceContent">
                    <!-- Content will be inserted here -->
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }
    
    updateReferenceModalContent(modal, reference) {
        const titleEl = modal.querySelector('#referenceTitle');
        const contentEl = modal.querySelector('#referenceContent');
        
        const typeIcons = {
            'clinical_case': '🏥',
            'ideal_sequence': '📋',
            'knowledge': '📚'
        };
        
        const typeLabels = {
            'clinical_case': 'Cas clinique',
            'ideal_sequence': 'Séquence idéale',
            'knowledge': 'Base de connaissances'
        };
        
        titleEl.innerHTML = `
            <span class="ref-icon">${typeIcons[reference.type] || '📄'}</span>
            ${DOMUtils.escapeHtml(reference.title)}
        `;
        
        let html = '<div class="reference-detail">';
        
        // Metadata
        html += '<div class="reference-metadata">';
        html += `<span class="meta-item"><i class="fas fa-tag"></i> ${typeLabels[reference.type] || reference.type}</span>`;
        
        if (reference.categories && reference.categories.length > 0) {
            html += `<span class="meta-item"><i class="fas fa-folder"></i> ${reference.categories.join(', ')}</span>`;
        }
        
        if (reference.similarity_score) {
            html += `<span class="meta-item"><i class="fas fa-percentage"></i> Similarité: ${reference.similarity_score}%</span>`;
        }
        
        html += '</div>';
        
        // Content sections
        if (reference.content) {
            html += this.formatReferenceContent(reference.content, reference.type);
        }
        
        html += '</div>';
        
        contentEl.innerHTML = html;
    }
    
    formatReferenceContent(content, type) {
        let html = '';
        
        if (type === 'clinical_case') {
            // Format clinical case
            if (content.patient_profile) {
                html += '<div class="content-section">';
                html += '<h4>Profil patient</h4>';
                html += `<p>${DOMUtils.escapeHtml(content.patient_profile)}</p>`;
                html += '</div>';
            }
            
            if (content.chief_complaint) {
                html += '<div class="content-section">';
                html += '<h4>Motif de consultation</h4>';
                html += `<p>${DOMUtils.escapeHtml(content.chief_complaint)}</p>`;
                html += '</div>';
            }
            
            if (content.clinical_findings) {
                html += '<div class="content-section">';
                html += '<h4>Constatations cliniques</h4>';
                html += `<p>${DOMUtils.escapeHtml(content.clinical_findings)}</p>`;
                html += '</div>';
            }
            
            if (content.treatment_sequence) {
                html += '<div class="content-section">';
                html += '<h4>Séquence de traitement</h4>';
                html += this.formatTreatmentSequence(content.treatment_sequence);
                html += '</div>';
            }
            
            if (content.outcome) {
                html += '<div class="content-section">';
                html += '<h4>Résultat</h4>';
                html += `<p>${DOMUtils.escapeHtml(content.outcome)}</p>`;
                html += '</div>';
            }
            
        } else if (type === 'ideal_sequence') {
            // Format ideal sequence
            if (content.condition) {
                html += '<div class="content-section">';
                html += '<h4>Condition</h4>';
                html += `<p>${DOMUtils.escapeHtml(content.condition)}</p>`;
                html += '</div>';
            }
            
            if (content.sequence_steps) {
                html += '<div class="content-section">';
                html += '<h4>Étapes de traitement</h4>';
                html += this.formatSequenceSteps(content.sequence_steps);
                html += '</div>';
            }
            
            if (content.important_notes) {
                html += '<div class="content-section">';
                html += '<h4>Notes importantes</h4>';
                html += `<p>${DOMUtils.escapeHtml(content.important_notes)}</p>`;
                html += '</div>';
            }
            
        } else {
            // Generic knowledge format
            if (typeof content === 'string') {
                html += `<div class="content-section"><p>${DOMUtils.escapeHtml(content)}</p></div>`;
            } else {
                Object.entries(content).forEach(([key, value]) => {
                    if (value) {
                        const label = key.replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                        html += '<div class="content-section">';
                        html += `<h4>${label}</h4>`;
                        html += `<p>${DOMUtils.escapeHtml(value)}</p>`;
                        html += '</div>';
                    }
                });
            }
        }
        
        return html;
    }
    
    formatTreatmentSequence(sequence) {
        if (!sequence || sequence.length === 0) return '<p>Aucune séquence disponible</p>';
        
        let html = '<table class="sequence-table">';
        html += '<thead><tr><th>RDV</th><th>Traitement</th><th>Durée</th><th>Délai</th></tr></thead>';
        html += '<tbody>';
        
        sequence.forEach((step, index) => {
            html += '<tr>';
            html += `<td>${step.rdv || index + 1}</td>`;
            html += `<td>${DOMUtils.escapeHtml(step.traitement)}</td>`;
            html += `<td>${step.duree || '-'}</td>`;
            html += `<td>${step.delai || '-'}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    formatSequenceSteps(steps) {
        if (!steps || steps.length === 0) return '<p>Aucune étape disponible</p>';
        
        let html = '<ol class="sequence-steps">';
        steps.forEach(step => {
            html += `<li>${DOMUtils.escapeHtml(step)}</li>`;
        });
        html += '</ol>';
        
        return html;
    }
    
    confirm(message, onConfirm) {
        const result = window.confirm(message);
        if (result && onConfirm) {
            onConfirm();
        }
        return result;
    }
    
    prompt(message, defaultValue = '') {
        return window.prompt(message, defaultValue);
    }
}

// Export singleton instance
export const modalManager = new ModalManager();

// Make it globally available for onclick handlers
window.modalManager = modalManager;