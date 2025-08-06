// Data Management JavaScript

let currentCategory = null;
let currentItem = null;
let categories = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
});

// Load categories
async function loadCategories() {
    try {
        const response = await fetch('/api/data/categories', {
            credentials: 'same-origin'
        });
        
        // Check if we got a redirect (likely to login page)
        if (response.redirected || response.status === 401) {
            window.location.href = '/auth/login';
            return;
        }
        
        // Check if response is OK
        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            showNotification('error', `Erreur ${response.status}: ${response.statusText}`);
            return;
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            categories = result.categories;
            displayCategories(result.categories);
        } else {
            const errorMsg = result.message || 'Erreur lors du chargement des catégories';
            console.error('Error from server:', errorMsg);
            showNotification('error', errorMsg);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showNotification('error', `Erreur de connexion: ${error.message}`);
    }
}

// Display categories
function displayCategories(categories) {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '';
    
    categories.forEach(category => {
        const iconClass = getIconClass(category.id);
        const card = document.createElement('div');
        card.className = 'category-card';
        card.onclick = () => loadCategoryItems(category.id);
        
        card.innerHTML = `
            <div class="category-icon ${iconClass}">
                <i class="${category.icon}"></i>
            </div>
            <h3>${category.name}</h3>
            <p class="category-description">${category.description}</p>
            <div class="category-stats">
                <i class="fas fa-file"></i>
                <span>${category.item_count} éléments</span>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// Get icon class based on category
function getIconClass(categoryId) {
    const iconClasses = {
        'clinical_cases': 'clinical',
        'ideal_sequences': 'sequences',
        'dental_knowledge': 'knowledge',
        'enhanced_knowledge': 'enhanced'
    };
    return iconClasses[categoryId] || 'knowledge';
}

// Load items for a category
async function loadCategoryItems(categoryId) {
    currentCategory = categoryId;
    
    try {
        const response = await fetch(`/api/data/items/${categoryId}`, {
            credentials: 'same-origin'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            displayItems(result.items);
            
            // Update UI
            const category = categories.find(c => c.id === categoryId);
            document.getElementById('categoryTitle').textContent = category.name;
            document.getElementById('categoriesGrid').parentElement.style.display = 'none';
            document.getElementById('itemsSection').style.display = 'block';
        } else {
            showNotification('error', 'Erreur lors du chargement des éléments');
        }
    } catch (error) {
        console.error('Error loading items:', error);
        showNotification('error', 'Erreur de connexion');
    }
}

// Display items
function displayItems(items) {
    const grid = document.getElementById('itemsGrid');
    grid.innerHTML = '';
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.onclick = () => loadItemDetail(item.id);
        
        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            tagsHtml = `
                <div class="item-tags">
                    ${item.tags.slice(0, 3).map(tag => `<span class="item-tag">${tag}</span>`).join('')}
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="item-header">
                <h4 class="item-title">${item.title}</h4>
                ${item.treatment_type ? `<span class="item-type">${item.treatment_type}</span>` : ''}
            </div>
            <p class="item-description">${item.description || 'Pas de description'}</p>
            ${tagsHtml}
        `;
        
        grid.appendChild(card);
    });
}

// Load item detail
async function loadItemDetail(itemId) {
    currentItem = itemId;
    
    try {
        const response = await fetch(`/api/data/item/${currentCategory}/${itemId}`, {
            credentials: 'same-origin'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            displayItemDetail(result.item);
            
            // Update UI
            document.getElementById('itemTitle').textContent = result.item.title || itemId;
            document.getElementById('itemsSection').style.display = 'none';
            document.getElementById('itemDetailSection').style.display = 'block';
        } else {
            showNotification('error', 'Erreur lors du chargement de l\'élément');
        }
    } catch (error) {
        console.error('Error loading item:', error);
        showNotification('error', 'Erreur de connexion');
    }
}

// Display item detail
function displayItemDetail(item) {
    const content = document.getElementById('itemContent');
    content.innerHTML = '';
    
    // Remove metadata before display
    const displayData = { ...item };
    delete displayData._metadata;
    
    // Add console logging to debug
    console.log('Current category:', currentCategory);
    console.log('Item data:', displayData);
    
    // Display based on category type
    console.log('Checking category type for rendering...');
    
    // Check if data has treatment_sequence to determine render method
    if (displayData.treatment_sequence && displayData.consultation_text) {
        // This looks like a treatment planning or ideal sequence format
        if (currentCategory === 'clinical_cases' || currentCategory === 'TRAITEMENTS_JSON') {
            console.log('Rendering as clinical case');
            content.innerHTML = renderClinicalCase(displayData);
        } else if (currentCategory === 'ideal_sequences' || currentCategory === 'IDEAL_SEQUENCES_ENHANCED' || currentCategory === 'IDEAL_SEQUENCES_JSON') {
            console.log('Rendering as ideal sequence');
            content.innerHTML = renderIdealSequence(displayData);
        } else {
            console.log('Has treatment_sequence but unknown category, rendering as clinical case');
            content.innerHTML = renderClinicalCase(displayData);
        }
    } else if (currentCategory === 'clinical_cases') {
        console.log('Rendering as clinical case (by category)');
        content.innerHTML = renderClinicalCase(displayData);
    } else if (currentCategory === 'ideal_sequences') {
        console.log('Rendering as ideal sequence (by category)');
        content.innerHTML = renderIdealSequence(displayData);
    } else if (currentCategory === 'approved_sequences') {
        console.log('Rendering as approved sequence');
        content.innerHTML = renderApprovedSequence(displayData);
    } else {
        console.log('Rendering as generic JSON');
        content.innerHTML = renderGenericJSON(displayData);
    }
}

// Render clinical case
function renderClinicalCase(data) {
    console.log('Rendering clinical case with data:', data);
    
    let html = '<div class="json-content">';
    
    // Check if this is a treatment planning case
    if (data.consultation_text && data.treatment_sequence) {
        // Handle treatment planning format
        html += `
            <div class="json-section">
                <h3 class="json-section-title">Plan de Traitement</h3>
                <div class="json-field">
                    <div class="json-field-label">Consultation</div>
                    <div class="json-field-value">${data.consultation_text.replace(/\n/g, '<br>')}</div>
                </div>
            </div>
        `;
        
        // Treatment sequence table
        if (data.treatment_sequence && data.treatment_sequence.length > 0) {
            html += `
                <div class="json-section">
                    <h3 class="json-section-title">Séquence de Traitement</h3>
                    <table class="treatment-sequence-table">
                        <thead>
                            <tr>
                                <th>RDV</th>
                                <th>Traitement</th>
                                <th>Durée</th>
                                <th>Délai</th>
                                <th>Dr</th>
                                <th>Date</th>
                                <th>Remarque</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.treatment_sequence.map(step => `
                                <tr>
                                    <td>${step.rdv || ''}</td>
                                    <td>${step.traitement || ''}</td>
                                    <td>${step.duree || ''}</td>
                                    <td>${step.delai || ''}</td>
                                    <td>${step.dr || ''}</td>
                                    <td>${step.date || ''}</td>
                                    <td>${step.remarque || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } else {
        // Handle other clinical case formats
        html += `
            <div class="json-section">
                <h3 class="json-section-title">Informations Générales</h3>
                <div class="json-field">
                    <div class="json-field-label">Titre du cas</div>
                    <div class="json-field-value">${data.case_title || 'N/A'}</div>
                </div>
                <div class="json-field">
                    <div class="json-field-label">Description</div>
                    <div class="json-field-value">${data.case_description || 'N/A'}</div>
                </div>
                <div class="json-field">
                    <div class="json-field-label">Âge du patient</div>
                    <div class="json-field-value">${data.patient_age || 'N/A'}</div>
                </div>
                <div class="json-field">
                    <div class="json-field-label">Type de traitement</div>
                    <div class="json-field-value">${data.treatment_type || 'N/A'}</div>
                </div>
            </div>
        `;
        
        // Treatment sequence
        if (data.treatment_sequence && data.treatment_sequence.length > 0) {
            html += `
                <div class="json-section">
                    <h3 class="json-section-title">Séquence de Traitement</h3>
                    <ul class="json-array">
                        ${data.treatment_sequence.map(step => `
                            <li>
                                <strong>Étape ${step.step}:</strong> ${step.treatment}<br>
                                <small>Durée: ${step.duration || 'N/A'}</small>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Clinical notes
        if (data.clinical_notes) {
            html += `
                <div class="json-section">
                    <h3 class="json-section-title">Notes Cliniques</h3>
                    <div class="json-field-value">${data.clinical_notes}</div>
                </div>
            `;
        }
    }
    
    html += '</div>';
    return html;
}

// Render ideal sequence
function renderIdealSequence(data) {
    console.log('Rendering ideal sequence with data:', data);
    
    let html = '<div class="json-content">';
    
    // Check if this is an ideal sequence with the standard format
    if (data.consultation_text && data.treatment_sequence) {
        // Handle ideal sequence format
        html += `
            <div class="json-section">
                <h3 class="json-section-title">Séquence Idéale</h3>
                <div class="json-field">
                    <div class="json-field-label">Procédure</div>
                    <div class="json-field-value">${data.consultation_text}</div>
                </div>
        `;
        
        // Add type and source if available
        if (data.type) {
            html += `
                <div class="json-field">
                    <div class="json-field-label">Type</div>
                    <div class="json-field-value">${data.type}</div>
                </div>
            `;
        }
        
        if (data.source || data.original_docx) {
            html += `
                <div class="json-field">
                    <div class="json-field-label">Source</div>
                    <div class="json-field-value">${data.source || data.original_docx}</div>
                </div>
            `;
        }
        
        html += `</div>`;
        
        // Treatment sequence table
        if (data.treatment_sequence && data.treatment_sequence.length > 0) {
            html += `
                <div class="json-section">
                    <h3 class="json-section-title">Séquence de Traitement</h3>
                    <table class="treatment-sequence-table">
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
                            ${data.treatment_sequence.map(step => `
                                <tr>
                                    <td>${step.rdv || ''}</td>
                                    <td>${step.traitement || ''}</td>
                                    <td>${step.duree || ''}</td>
                                    <td>${step.delai || ''}</td>
                                    <td>${step.dr || ''}</td>
                                    <td>${step.remarque || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // Enhanced treatment sequence if available
        if (data.treatment_sequence_enhanced && data.treatment_sequence_enhanced.length > 0) {
            html += `
                <div class="json-section">
                    <h3 class="json-section-title">Séquence de Traitement Améliorée</h3>
                    <table class="treatment-sequence-table">
                        <thead>
                            <tr>
                                <th>RDV</th>
                                <th>Traitement</th>
                                <th>Durée</th>
                                <th>Catégories</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.treatment_sequence_enhanced.map(step => `
                                <tr>
                                    <td>${step.rdv || ''}</td>
                                    <td>${step.traitement_expanded || step.traitement || ''}</td>
                                    <td>${step.duree || ''}</td>
                                    <td>${step.categories ? step.categories.join(', ') : ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } else {
        // Handle other ideal sequence formats
        html += `
            <div class="json-section">
                <h3 class="json-section-title">Informations de la Procédure</h3>
                <div class="json-field">
                    <div class="json-field-label">Nom de la procédure</div>
                    <div class="json-field-value">${data.procedure_name || 'N/A'}</div>
                </div>
                <div class="json-field">
                    <div class="json-field-label">Description</div>
                    <div class="json-field-value">${data.description || 'N/A'}</div>
                </div>
                <div class="json-field">
                    <div class="json-field-label">Durée totale</div>
                    <div class="json-field-value">${data.total_duration || 'N/A'}</div>
                </div>
                <div class="json-field">
                    <div class="json-field-label">Notation dentaire</div>
                    <div class="json-field-value">${data.tooth_notation || 'N/A'}</div>
                </div>
            </div>
        `;
        
        // Steps
        if (data.steps && data.steps.length > 0) {
            html += `
                <div class="json-section">
                    <h3 class="json-section-title">Étapes de la Procédure</h3>
                    <ul class="json-array">
                        ${data.steps.map((step, index) => `
                            <li>
                                <strong>${index + 1}. ${step.name || step.description}</strong><br>
                                ${step.duration ? `<small>Durée: ${step.duration}</small>` : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Materials
        if (data.materials && data.materials.length > 0) {
            html += `
                <div class="json-section">
                    <h3 class="json-section-title">Matériaux</h3>
                    <ul class="json-array">
                        ${data.materials.map(material => `<li>${material}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }
    
    html += '</div>';
    return html;
}

// Render generic JSON
function renderGenericJSON(data) {
    return `
        <div class="json-content">
            <pre class="json-field-value">${JSON.stringify(data, null, 2)}</pre>
        </div>
    `;
}

// Navigation functions
function showCategories() {
    document.getElementById('itemDetailSection').style.display = 'none';
    document.getElementById('itemsSection').style.display = 'none';
    document.getElementById('categoriesGrid').parentElement.style.display = 'block';
}

function showItems() {
    document.getElementById('itemDetailSection').style.display = 'none';
    document.getElementById('itemsSection').style.display = 'block';
}

// Store current edit data
let currentEditData = null;
let jsonViewActive = false;

// Edit item
function editItem() {
    if (!currentItem || !currentCategory) return;
    
    // Load current data
    fetch(`/api/data/item/${currentCategory}/${currentItem}`, {
        credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            const data = { ...result.item };
            delete data._metadata;
            
            currentEditData = data;
            
            // Set JSON editor value
            document.getElementById('jsonEditor').value = JSON.stringify(data, null, 2);
            
            // Create form based on category
            createEditForm(data);
            
            // Update modal title
            document.getElementById('editModalTitle').textContent = `Modifier: ${data.title || data.case_title || data.procedure_name || currentItem}`;
            
            // Show modal
            document.getElementById('editModal').style.display = 'flex';
            
            // Hide JSON view by default
            jsonViewActive = false;
            document.getElementById('jsonEditorContainer').style.display = 'none';
            document.getElementById('editFormContainer').style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error loading item for edit:', error);
        showNotification('error', 'Erreur lors du chargement');
    });
}

// Create edit form based on data type
function createEditForm(data) {
    const container = document.getElementById('editFormContainer');
    container.innerHTML = '';
    
    if (currentCategory === 'clinical_cases' || currentCategory === 'TRAITEMENTS_JSON') {
        container.innerHTML = createClinicalCaseForm(data);
    } else if (currentCategory === 'ideal_sequences' || currentCategory === 'IDEAL_SEQUENCES_ENHANCED') {
        container.innerHTML = createIdealSequenceForm(data);
    } else if (currentCategory === 'approved_sequences') {
        container.innerHTML = createApprovedSequenceForm(data);
    } else {
        container.innerHTML = createGenericForm(data);
    }
}

// Create clinical case edit form
function createClinicalCaseForm(data) {
    let html = '';
    
    // Basic information section
    html += `
        <div class="form-section">
            <h4 class="form-section-title">
                <i class="fas fa-info-circle"></i>
                Informations Générales
            </h4>
            <div class="form-group">
                <label for="case_title">Titre du cas</label>
                <input type="text" id="case_title" name="case_title" class="form-control" 
                       value="${escapeHtml(data.case_title || '')}">
            </div>
            <div class="form-group">
                <label for="case_description">Description</label>
                <textarea id="case_description" name="case_description" class="form-control" rows="3">${escapeHtml(data.case_description || '')}</textarea>
            </div>
            <div class="form-row" style="display: flex; gap: 16px;">
                <div class="form-group" style="flex: 1;">
                    <label for="patient_age">Âge du patient</label>
                    <input type="text" id="patient_age" name="patient_age" class="form-control" 
                           value="${escapeHtml(data.patient_age || '')}">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label for="treatment_type">Type de traitement</label>
                    <input type="text" id="treatment_type" name="treatment_type" class="form-control" 
                           value="${escapeHtml(data.treatment_type || '')}">
                </div>
            </div>
        </div>
    `;
    
    // Consultation text section
    if (data.consultation_text) {
        html += `
            <div class="form-section">
                <h4 class="form-section-title">
                    <i class="fas fa-file-medical"></i>
                    Plan de Traitement
                </h4>
                <div class="form-group">
                    <label for="consultation_text">Texte de consultation</label>
                    <textarea id="consultation_text" name="consultation_text" class="form-control" rows="6">${escapeHtml(data.consultation_text)}</textarea>
                </div>
            </div>
        `;
    }
    
    // Treatment sequence section
    html += `
        <div class="form-section">
            <h4 class="form-section-title">
                <i class="fas fa-list-ol"></i>
                Séquence de Traitement
            </h4>
            <table class="table-form" id="treatmentSequenceTable">
                <thead>
                    <tr>
                        <th style="width: 60px;">RDV</th>
                        <th>Traitement</th>
                        <th style="width: 80px;">Durée</th>
                        <th style="width: 80px;">Délai</th>
                        <th style="width: 100px;">Dr</th>
                        <th style="width: 120px;">Date</th>
                        <th>Remarque</th>
                        <th style="width: 40px;"></th>
                    </tr>
                </thead>
                <tbody id="treatmentSequenceBody">
    `;
    
    // Add existing sequence items
    if (data.treatment_sequence && Array.isArray(data.treatment_sequence)) {
        data.treatment_sequence.forEach((item, index) => {
            html += createTreatmentSequenceRow(item, index);
        });
    }
    
    html += `
                </tbody>
            </table>
            <button type="button" class="add-row-btn" onclick="addTreatmentSequenceRow()">
                <i class="fas fa-plus"></i>
                Ajouter une étape
            </button>
        </div>
    `;
    
    // Clinical notes section
    if (data.clinical_notes !== undefined) {
        html += `
            <div class="form-section">
                <h4 class="form-section-title">
                    <i class="fas fa-notes-medical"></i>
                    Notes Cliniques
                </h4>
                <div class="form-group">
                    <label for="clinical_notes">Notes</label>
                    <textarea id="clinical_notes" name="clinical_notes" class="form-control" rows="4">${escapeHtml(data.clinical_notes || '')}</textarea>
                </div>
            </div>
        `;
    }
    
    return html;
}

// Create treatment sequence row
function createTreatmentSequenceRow(item = {}, index) {
    return `
        <tr>
            <td><input type="text" name="seq_rdv_${index}" value="${escapeHtml(item.rdv || '')}" placeholder="1"></td>
            <td><input type="text" name="seq_traitement_${index}" value="${escapeHtml(item.traitement || '')}" placeholder="Traitement..."></td>
            <td><input type="text" name="seq_duree_${index}" value="${escapeHtml(item.duree || '')}" placeholder="30 min"></td>
            <td><input type="text" name="seq_delai_${index}" value="${escapeHtml(item.delai || '')}" placeholder="J+0"></td>
            <td><input type="text" name="seq_dr_${index}" value="${escapeHtml(item.dr || '')}" placeholder="Dr."></td>
            <td><input type="date" name="seq_date_${index}" value="${escapeHtml(item.date || '')}"></td>
            <td><input type="text" name="seq_remarque_${index}" value="${escapeHtml(item.remarque || '')}" placeholder="Notes..."></td>
            <td><button type="button" class="remove-row-btn" onclick="removeTableRow(this)"><i class="fas fa-times"></i></button></td>
        </tr>
    `;
}

// Add treatment sequence row
function addTreatmentSequenceRow() {
    const tbody = document.getElementById('treatmentSequenceBody');
    const rowCount = tbody.querySelectorAll('tr').length;
    const newRow = document.createElement('tr');
    newRow.innerHTML = createTreatmentSequenceRow({}, rowCount).replace('<tr>', '').replace('</tr>', '');
    tbody.appendChild(newRow);
}

// Create ideal sequence edit form
function createIdealSequenceForm(data) {
    let html = '';
    
    // Basic information
    html += `
        <div class="form-section">
            <h4 class="form-section-title">
                <i class="fas fa-info-circle"></i>
                Informations de la Procédure
            </h4>
            <div class="form-group">
                <label for="procedure_name">Nom de la procédure</label>
                <input type="text" id="procedure_name" name="procedure_name" class="form-control" 
                       value="${escapeHtml(data.procedure_name || '')}">
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" class="form-control" rows="3">${escapeHtml(data.description || '')}</textarea>
            </div>
            <div class="form-row" style="display: flex; gap: 16px;">
                <div class="form-group" style="flex: 1;">
                    <label for="total_duration">Durée totale</label>
                    <input type="text" id="total_duration" name="total_duration" class="form-control" 
                           value="${escapeHtml(data.total_duration || '')}">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label for="tooth_notation">Notation dentaire</label>
                    <input type="text" id="tooth_notation" name="tooth_notation" class="form-control" 
                           value="${escapeHtml(data.tooth_notation || '')}">
                </div>
            </div>
        </div>
    `;
    
    // Steps section
    if (data.steps && Array.isArray(data.steps)) {
        html += `
            <div class="form-section">
                <h4 class="form-section-title">
                    <i class="fas fa-list-check"></i>
                    Étapes de la Procédure
                </h4>
                <div id="stepsContainer">
        `;
        
        data.steps.forEach((step, index) => {
            html += createStepForm(step, index);
        });
        
        html += `
                </div>
                <button type="button" class="add-row-btn" onclick="addStep()">
                    <i class="fas fa-plus"></i>
                    Ajouter une étape
                </button>
            </div>
        `;
    }
    
    // Materials section
    if (data.materials !== undefined) {
        html += `
            <div class="form-section">
                <h4 class="form-section-title">
                    <i class="fas fa-tools"></i>
                    Matériaux et Instruments
                </h4>
                <div class="form-group">
                    <label for="materials">Matériaux (un par ligne)</label>
                    <textarea id="materials" name="materials" class="form-control" rows="4">${Array.isArray(data.materials) ? data.materials.join('\n') : ''}</textarea>
                </div>
            </div>
        `;
    }
    
    return html;
}

// Create step form
function createStepForm(step = {}, index) {
    return `
        <div class="step-item" style="margin-bottom: 16px; padding: 16px; background: white; border: 1px solid #e5e7eb; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h5 style="margin: 0; color: #374151;">Étape ${index + 1}</h5>
                <button type="button" class="remove-row-btn" onclick="removeStep(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="form-group">
                <label>Nom de l'étape</label>
                <input type="text" name="step_name_${index}" class="form-control" 
                       value="${escapeHtml(step.name || step.description || '')}" placeholder="Nom de l'étape">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="step_description_${index}" class="form-control" rows="2" 
                          placeholder="Description détaillée">${escapeHtml(step.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Durée</label>
                <input type="text" name="step_duration_${index}" class="form-control" 
                       value="${escapeHtml(step.duration || '')}" placeholder="Ex: 15 min">
            </div>
        </div>
    `;
}

// Add step
function addStep() {
    const container = document.getElementById('stepsContainer');
    const stepCount = container.querySelectorAll('.step-item').length;
    const newStep = document.createElement('div');
    newStep.innerHTML = createStepForm({}, stepCount);
    container.appendChild(newStep.firstElementChild);
}

// Remove step
function removeStep(button) {
    button.closest('.step-item').remove();
    // Renumber steps
    const steps = document.querySelectorAll('.step-item h5');
    steps.forEach((h5, index) => {
        h5.textContent = `Étape ${index + 1}`;
    });
}

// Create generic form for other data types
function createGenericForm(data) {
    let html = '<div class="form-section">';
    
    // Create form fields for each property
    Object.keys(data).forEach(key => {
        if (key === '_metadata' || key === 'created_at' || key === 'last_updated') return;
        
        const value = data[key];
        const fieldId = `generic_${key}`;
        
        html += '<div class="form-group">';
        html += `<label for="${fieldId}">${formatFieldName(key)}</label>`;
        
        if (typeof value === 'string' && value.length > 100) {
            html += `<textarea id="${fieldId}" name="${key}" class="form-control" rows="4">${escapeHtml(value)}</textarea>`;
        } else if (typeof value === 'boolean') {
            html += `<select id="${fieldId}" name="${key}" class="form-control">
                <option value="true" ${value ? 'selected' : ''}>Oui</option>
                <option value="false" ${!value ? 'selected' : ''}>Non</option>
            </select>`;
        } else if (Array.isArray(value)) {
            html += `<textarea id="${fieldId}" name="${key}" class="form-control" rows="3">${value.join('\n')}</textarea>`;
            html += '<small class="form-text">Un élément par ligne</small>';
        } else {
            html += `<input type="text" id="${fieldId}" name="${key}" class="form-control" value="${escapeHtml(value || '')}">`;
        }
        
        html += '</div>';
    });
    
    html += '</div>';
    return html;
}

// Render approved sequence
function renderApprovedSequence(data) {
    console.log('Rendering approved sequence with data:', data);
    
    let html = '<div class="approved-sequence-content">';
    
    // Header with rating and approval info
    html += `
        <div class="approval-header" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #212529;">
                        <i class="fas fa-check-circle" style="color: #28a745;"></i>
                        Séquence Approuvée
                    </h3>
                    <p style="margin: 0; color: #212529; font-size: 16px;">
                        <strong>Prompt original:</strong> ${escapeHtml(data.original_prompt || 'Non spécifié')}
                    </p>
                </div>
                <div style="text-align: center;">
                    <div class="rating-display" style="font-size: 24px; color: #ffd700;">
                        ${generateStars(data.rating || 0)}
                    </div>
                    <p style="margin: 5px 0 0 0; font-weight: bold; color: ${data.rating >= 9 ? '#28a745' : '#212529'};">
                        ${data.rating || 0}/10
                        ${data.rating >= 9 ? '<br><span style="font-size: 12px; color: #28a745;">(Utilisé pour l\'IA)</span>' : ''}
                    </p>
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                <p style="margin: 0; color: #495057; font-size: 14px;">
                    <i class="fas fa-user" style="color: #6c757d;"></i> Approuvé par: <strong style="color: #212529;">${escapeHtml(data.approved_by || 'Utilisateur')}</strong>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    <i class="fas fa-calendar" style="color: #6c757d;"></i> Date: <strong style="color: #212529;">${formatDate(data.approved_date || data.created_at)}</strong>
                    ${data.use_in_rag ? '&nbsp;&nbsp;|&nbsp;&nbsp;<i class="fas fa-brain" style="color: #28a745;"></i> <strong style="color: #28a745;">Actif dans RAG</strong>' : ''}
                </p>
            </div>
        </div>
    `;
    
    // Treatment sequence table
    if (data.sequence && Array.isArray(data.sequence)) {
        html += `
            <div class="sequence-section">
                <h4 style="margin-bottom: 15px; color: #212529;">
                    <i class="fas fa-list-ol"></i> Séquence de traitement
                </h4>
                <table class="treatment-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #e9ecef;">
                            <th style="padding: 10px; border: 1px solid #dee2e6; color: #212529; font-weight: 600;">RDV</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6; color: #212529; font-weight: 600;">Traitement</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6; color: #212529; font-weight: 600;">Durée</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6; color: #212529; font-weight: 600;">Délai</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6; color: #212529; font-weight: 600;">Dr</th>
                            <th style="padding: 10px; border: 1px solid #dee2e6; color: #212529; font-weight: 600;">Remarque</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.sequence.forEach((step, index) => {
            html += `
                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; color: #212529; font-weight: 500;">
                        ${escapeHtml(step.rdv || '')}
                    </td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; color: #212529;">
                        ${escapeHtml(step.traitement || '')}
                    </td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; color: #495057;">
                        ${escapeHtml(step.duree || '')}
                    </td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; color: #495057;">
                        ${escapeHtml(step.delai || '-')}
                    </td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; color: #495057;">
                        ${escapeHtml(step.dr || '')}
                    </td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; color: #495057;">
                        ${escapeHtml(step.remarque || '-')}
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Keywords if available
    if (data.keywords && data.keywords.length > 0) {
        html += `
            <div style="margin-top: 20px;">
                <h4 style="color: #212529;"><i class="fas fa-tags"></i> Mots-clés</h4>
                <div>
                    ${data.keywords.map(k => `<span class="keyword-tag" style="display: inline-block; padding: 5px 10px; margin: 5px; background: #e9ecef; border-radius: 4px; color: #495057; font-weight: 500;">${escapeHtml(k)}</span>`).join('')}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// Helper function to generate star display
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 10; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }
    return stars;
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return 'Non spécifié';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// Create approved sequence edit form
function createApprovedSequenceForm(data) {
    let html = '';
    
    // Basic information section
    html += `
        <div class="form-section">
            <h4 class="form-section-title">
                <i class="fas fa-info-circle"></i> Informations de base
            </h4>
            <div class="form-row">
                <div class="form-group flex-1">
                    <label for="original_prompt">Prompt original *</label>
                    <input type="text" id="original_prompt" name="original_prompt" class="form-control" 
                           value="${escapeHtml(data.original_prompt || '')}" required>
                </div>
                <div class="form-group" style="width: 150px;">
                    <label for="rating">Note *</label>
                    <select id="rating" name="rating" class="form-control" required>
                        ${[1,2,3,4,5,6,7,8,9,10].map(i => 
                            `<option value="${i}" ${data.rating === i ? 'selected' : ''}>${i}/10</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group flex-1">
                    <label for="approved_by">Approuvé par</label>
                    <input type="text" id="approved_by" name="approved_by" class="form-control" 
                           value="${escapeHtml(data.approved_by || '')}" readonly>
                </div>
                <div class="form-group flex-1">
                    <label for="approved_date">Date d'approbation</label>
                    <input type="text" id="approved_date" name="approved_date" class="form-control" 
                           value="${formatDate(data.approved_date || data.created_at)}" readonly>
                </div>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="use_in_rag" name="use_in_rag" 
                           ${data.use_in_rag ? 'checked' : ''}>
                    Utiliser dans le système RAG (pour les suggestions IA)
                </label>
            </div>
        </div>
    `;
    
    // Treatment sequence section
    html += `
        <div class="form-section">
            <h4 class="form-section-title">
                <i class="fas fa-list-ol"></i> Séquence de traitement
            </h4>
            <div class="table-responsive">
                <table class="form-table">
                    <thead>
                        <tr>
                            <th width="60">RDV</th>
                            <th>Traitement *</th>
                            <th width="100">Durée</th>
                            <th width="100">Délai</th>
                            <th width="80">Dr</th>
                            <th>Remarque</th>
                            <th width="40"></th>
                        </tr>
                    </thead>
                    <tbody id="sequenceTableBody">
    `;
    
    // Add existing sequence steps
    if (data.sequence && Array.isArray(data.sequence)) {
        data.sequence.forEach((step, index) => {
            html += createSequenceRow(step, index);
        });
    }
    
    html += `
                    </tbody>
                </table>
                <button type="button" class="add-btn" onclick="addSequenceRow()">
                    <i class="fas fa-plus"></i> Ajouter une étape
                </button>
            </div>
        </div>
    `;
    
    // Keywords section
    html += `
        <div class="form-section">
            <h4 class="form-section-title">
                <i class="fas fa-tags"></i> Mots-clés
            </h4>
            <div class="form-group">
                <label for="keywords">Mots-clés (un par ligne)</label>
                <textarea id="keywords" name="keywords" class="form-control" rows="3">${(data.keywords || []).join('\n')}</textarea>
            </div>
        </div>
    `;
    
    return html;
}

// Create sequence row for approved sequences
function createSequenceRow(step = {}, index) {
    return `
        <tr>
            <td>
                <input type="text" name="sequence[${index}][rdv]" 
                       value="${escapeHtml(step.rdv || (index + 1).toString())}" 
                       class="form-control text-center" readonly>
            </td>
            <td>
                <input type="text" name="sequence[${index}][traitement]" 
                       value="${escapeHtml(step.traitement || '')}" 
                       class="form-control" required>
            </td>
            <td>
                <input type="text" name="sequence[${index}][duree]" 
                       value="${escapeHtml(step.duree || '')}" 
                       class="form-control">
            </td>
            <td>
                <input type="text" name="sequence[${index}][delai]" 
                       value="${escapeHtml(step.delai || '')}" 
                       class="form-control">
            </td>
            <td>
                <input type="text" name="sequence[${index}][dr]" 
                       value="${escapeHtml(step.dr || '')}" 
                       class="form-control">
            </td>
            <td>
                <input type="text" name="sequence[${index}][remarque]" 
                       value="${escapeHtml(step.remarque || '')}" 
                       class="form-control">
            </td>
            <td>
                <button type="button" class="delete-btn" onclick="removeTableRow(this)" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
}

// Add sequence row for approved sequences
function addSequenceRow() {
    const tbody = document.getElementById('sequenceTableBody');
    const rowCount = tbody.querySelectorAll('tr').length;
    const newRow = document.createElement('tr');
    newRow.innerHTML = createSequenceRow({}, rowCount);
    tbody.appendChild(newRow);
    
    // Update RDV numbers
    updateSequenceNumbers();
}

// Update sequence numbers after adding/removing rows
function updateSequenceNumbers() {
    const rows = document.querySelectorAll('#sequenceTableBody tr');
    rows.forEach((row, index) => {
        const rdvInput = row.querySelector('input[name*="[rdv]"]');
        if (rdvInput) {
            rdvInput.value = (index + 1).toString();
            // Update the name attribute to maintain correct index
            row.querySelectorAll('input').forEach(input => {
                if (input.name) {
                    input.name = input.name.replace(/\[\d+\]/, `[${index}]`);
                }
            });
        }
    });
}

// Helper functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function formatFieldName(name) {
    return name
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

function removeTableRow(button) {
    button.closest('tr').remove();
    // Update sequence numbers if this is an approved sequence
    if (currentCategory === 'approved_sequences') {
        updateSequenceNumbers();
    }
}

// Toggle JSON view
function toggleJSONView() {
    jsonViewActive = !jsonViewActive;
    
    if (jsonViewActive) {
        // Update JSON from form
        updateJSONFromForm();
        document.getElementById('jsonEditorContainer').style.display = 'block';
        document.getElementById('editFormContainer').style.display = 'none';
    } else {
        // Update form from JSON
        try {
            currentEditData = JSON.parse(document.getElementById('jsonEditor').value);
            createEditForm(currentEditData);
            document.getElementById('jsonEditorContainer').style.display = 'none';
            document.getElementById('editFormContainer').style.display = 'block';
        } catch (e) {
            showNotification('error', 'JSON invalide');
            jsonViewActive = true;
        }
    }
}

// Update JSON from form data
function updateJSONFromForm() {
    const formData = collectFormData();
    document.getElementById('jsonEditor').value = JSON.stringify(formData, null, 2);
}

// Collect form data
function collectFormData() {
    const data = { ...currentEditData };
    
    if (currentCategory === 'clinical_cases' || currentCategory === 'TRAITEMENTS_JSON') {
        // Basic fields
        data.case_title = document.getElementById('case_title')?.value || '';
        data.case_description = document.getElementById('case_description')?.value || '';
        data.patient_age = document.getElementById('patient_age')?.value || '';
        data.treatment_type = document.getElementById('treatment_type')?.value || '';
        
        if (document.getElementById('consultation_text')) {
            data.consultation_text = document.getElementById('consultation_text').value;
        }
        
        if (document.getElementById('clinical_notes')) {
            data.clinical_notes = document.getElementById('clinical_notes').value;
        }
        
        // Treatment sequence
        const sequenceRows = document.querySelectorAll('#treatmentSequenceBody tr');
        data.treatment_sequence = [];
        
        sequenceRows.forEach((row, index) => {
            const sequence = {
                rdv: row.querySelector(`[name="seq_rdv_${index}"]`)?.value || '',
                traitement: row.querySelector(`[name="seq_traitement_${index}"]`)?.value || '',
                duree: row.querySelector(`[name="seq_duree_${index}"]`)?.value || '',
                delai: row.querySelector(`[name="seq_delai_${index}"]`)?.value || '',
                dr: row.querySelector(`[name="seq_dr_${index}"]`)?.value || '',
                date: row.querySelector(`[name="seq_date_${index}"]`)?.value || '',
                remarque: row.querySelector(`[name="seq_remarque_${index}"]`)?.value || ''
            };
            
            if (sequence.traitement) {
                data.treatment_sequence.push(sequence);
            }
        });
        
    } else if (currentCategory === 'approved_sequences') {
        // Basic fields
        data.original_prompt = document.getElementById('original_prompt')?.value || '';
        data.rating = parseInt(document.getElementById('rating')?.value) || 0;
        data.use_in_rag = document.getElementById('use_in_rag')?.checked || false;
        
        // Keep readonly fields
        data.approved_by = document.getElementById('approved_by')?.value || data.approved_by;
        data.approved_date = data.approved_date; // Keep original date
        
        // Collect sequence data
        const sequenceRows = document.querySelectorAll('#sequenceTableBody tr');
        data.sequence = [];
        
        sequenceRows.forEach((row) => {
            const step = {
                rdv: row.querySelector('input[name*="[rdv]"]')?.value || '',
                traitement: row.querySelector('input[name*="[traitement]"]')?.value || '',
                duree: row.querySelector('input[name*="[duree]"]')?.value || '',
                delai: row.querySelector('input[name*="[delai]"]')?.value || '',
                dr: row.querySelector('input[name*="[dr]"]')?.value || '',
                remarque: row.querySelector('input[name*="[remarque]"]')?.value || ''
            };
            
            if (step.traitement) {
                data.sequence.push(step);
            }
        });
        
        // Keywords
        const keywordsText = document.getElementById('keywords')?.value || '';
        data.keywords = keywordsText.split('\n').filter(k => k.trim()).map(k => k.trim());
        
    } else if (currentCategory === 'ideal_sequences' || currentCategory === 'IDEAL_SEQUENCES_ENHANCED') {
        // Basic fields
        data.procedure_name = document.getElementById('procedure_name')?.value || '';
        data.description = document.getElementById('description')?.value || '';
        data.total_duration = document.getElementById('total_duration')?.value || '';
        data.tooth_notation = document.getElementById('tooth_notation')?.value || '';
        
        // Steps
        const stepItems = document.querySelectorAll('.step-item');
        data.steps = [];
        
        stepItems.forEach((item, index) => {
            const step = {
                name: item.querySelector(`[name="step_name_${index}"]`)?.value || '',
                description: item.querySelector(`[name="step_description_${index}"]`)?.value || '',
                duration: item.querySelector(`[name="step_duration_${index}"]`)?.value || ''
            };
            
            if (step.name || step.description) {
                data.steps.push(step);
            }
        });
        
        // Materials
        if (document.getElementById('materials')) {
            const materialsText = document.getElementById('materials').value;
            data.materials = materialsText.split('\n').filter(m => m.trim());
        }
        
    } else {
        // Generic form collection
        const inputs = document.querySelectorAll('#editFormContainer input, #editFormContainer textarea, #editFormContainer select');
        inputs.forEach(input => {
            const name = input.name;
            if (name && !name.startsWith('seq_') && !name.startsWith('step_')) {
                let value = input.value;
                
                // Handle arrays
                if (input.tagName === 'TEXTAREA' && value.includes('\n')) {
                    value = value.split('\n').filter(v => v.trim());
                }
                
                // Handle booleans
                if (input.tagName === 'SELECT' && (value === 'true' || value === 'false')) {
                    value = value === 'true';
                }
                
                data[name] = value;
            }
        });
    }
    
    return data;
}

// Save item
async function saveItem(event) {
    event.preventDefault();
    
    let data;
    
    // Get data based on current view
    if (jsonViewActive) {
        // Get data from JSON editor
        const jsonText = document.getElementById('jsonEditor').value;
        try {
            data = JSON.parse(jsonText);
        } catch (error) {
            showNotification('error', 'JSON invalide');
            return;
        }
    } else {
        // Collect data from form
        data = collectFormData();
    }
    
    try {
        const response = await fetch(`/api/data/item/${currentCategory}/${currentItem}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showNotification('success', 'Élément mis à jour avec succès');
            closeEditModal();
            loadItemDetail(currentItem);
        } else {
            showNotification('error', result.message || 'Erreur lors de la sauvegarde');
        }
    } catch (error) {
        showNotification('error', 'Erreur lors de la sauvegarde');
    }
}

// Delete item
function deleteItem() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) return;
    
    fetch(`/api/data/item/${currentCategory}/${currentItem}`, {
        method: 'DELETE',
        credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            showNotification('success', 'Élément supprimé');
            showItems();
            loadCategoryItems(currentCategory);
        } else {
            showNotification('error', result.message || 'Erreur lors de la suppression');
        }
    })
    .catch(error => {
        console.error('Error deleting item:', error);
        showNotification('error', 'Erreur lors de la suppression');
    });
}

// Variables for new item creation
let newItemData = {};
let newItemJsonView = false;

// Add new item
function showAddItemModal() {
    document.getElementById('itemTemplate').value = '';
    document.getElementById('newItemFormContainer').style.display = 'none';
    document.getElementById('newItemAdvancedToggle').style.display = 'none';
    document.getElementById('newItemJsonContainer').style.display = 'none';
    document.getElementById('newItemEditor').value = '';
    newItemData = {};
    newItemJsonView = false;
    document.getElementById('addItemModal').style.display = 'flex';
}

// Load template
function loadTemplate() {
    const templateType = document.getElementById('itemTemplate').value;
    
    if (!templateType) {
        document.getElementById('newItemFormContainer').style.display = 'none';
        document.getElementById('newItemAdvancedToggle').style.display = 'none';
        return;
    }
    
    let template = {};
    let formHtml = '';
    
    if (templateType === 'clinical_case') {
        template = {
            case_title: "",
            case_description: "",
            patient_age: "",
            treatment_type: "",
            consultation_text: "",
            treatment_sequence: [],
            clinical_notes: "",
            keywords: []
        };
        formHtml = createClinicalCaseForm(template);
    } else if (templateType === 'ideal_sequence') {
        template = {
            procedure_name: "",
            description: "",
            total_duration: "",
            tooth_notation: "",
            steps: [],
            materials: [],
            keywords: []
        };
        formHtml = createIdealSequenceForm(template);
    } else if (templateType === 'knowledge') {
        template = {
            title: "",
            content: "",
            category: "",
            keywords: []
        };
        formHtml = createGenericForm(template);
    }
    
    newItemData = template;
    document.getElementById('newItemEditor').value = JSON.stringify(template, null, 2);
    document.getElementById('newItemFormContainer').innerHTML = formHtml;
    document.getElementById('newItemFormContainer').style.display = 'block';
    document.getElementById('newItemAdvancedToggle').style.display = 'block';
}

// Toggle JSON view for new item
function toggleNewItemJSONView() {
    newItemJsonView = !newItemJsonView;
    
    if (newItemJsonView) {
        // Update JSON from form
        updateNewItemJSON();
        document.getElementById('newItemJsonContainer').style.display = 'block';
        document.getElementById('newItemFormContainer').style.display = 'none';
    } else {
        // Update form from JSON
        try {
            newItemData = JSON.parse(document.getElementById('newItemEditor').value);
            const templateType = document.getElementById('itemTemplate').value;
            let formHtml = '';
            
            if (templateType === 'clinical_case') {
                formHtml = createClinicalCaseForm(newItemData);
            } else if (templateType === 'ideal_sequence') {
                formHtml = createIdealSequenceForm(newItemData);
            } else {
                formHtml = createGenericForm(newItemData);
            }
            
            document.getElementById('newItemFormContainer').innerHTML = formHtml;
            document.getElementById('newItemJsonContainer').style.display = 'none';
            document.getElementById('newItemFormContainer').style.display = 'block';
        } catch (e) {
            showNotification('error', 'JSON invalide');
            newItemJsonView = true;
        }
    }
}

// Update JSON from new item form
function updateNewItemJSON() {
    const data = collectFormData();
    document.getElementById('newItemEditor').value = JSON.stringify(data, null, 2);
}

// Create new item
async function createItem(event) {
    event.preventDefault();
    
    let data;
    
    // Check if template is selected
    const templateType = document.getElementById('itemTemplate').value;
    if (!templateType) {
        showNotification('error', 'Veuillez sélectionner un type d\'élément');
        return;
    }
    
    // Get data based on current view
    if (newItemJsonView) {
        // Get data from JSON editor
        const jsonText = document.getElementById('newItemEditor').value;
        try {
            data = JSON.parse(jsonText);
        } catch (error) {
            showNotification('error', 'JSON invalide');
            return;
        }
    } else {
        // Collect data from form
        data = collectFormData();
    }
    
    try {
        const response = await fetch(`/api/data/item/${currentCategory}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showNotification('success', 'Élément créé avec succès');
            closeAddItemModal();
            loadCategoryItems(currentCategory);
        } else {
            showNotification('error', result.message || 'Erreur lors de la création');
        }
    } catch (error) {
        showNotification('error', 'Erreur lors de la création');
    }
}

// Search data
async function searchData(event) {
    const query = event.target.value;
    
    if (query.length < 3) return;
    
    if (event.key === 'Enter') {
        try {
            const response = await fetch(`/api/data/search?q=${encodeURIComponent(query)}`, {
                credentials: 'same-origin'
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                // Display search results
                showNotification('success', `${result.results.length} résultats trouvés`);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }
}

// Reindex data
async function reindexData() {
    const btn = event.target.closest('.reindex-btn');
    btn.classList.add('loading');
    
    try {
        const response = await fetch('/reindex', {
            method: 'POST',
            credentials: 'same-origin'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showNotification('success', 'Réindexation terminée');
        } else {
            showNotification('error', 'Erreur lors de la réindexation');
        }
    } catch (error) {
        console.error('Reindex error:', error);
        showNotification('error', 'Erreur lors de la réindexation');
    } finally {
        btn.classList.remove('loading');
    }
}

// Modal functions
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function closeAddItemModal() {
    document.getElementById('addItemModal').style.display = 'none';
}

// JSON utilities
function formatJSON() {
    const editor = document.getElementById('jsonEditor');
    try {
        const json = JSON.parse(editor.value);
        editor.value = JSON.stringify(json, null, 2);
        showNotification('success', 'JSON formaté');
    } catch (e) {
        showNotification('error', 'JSON invalide');
    }
}

function formatNewJSON() {
    const editor = document.getElementById('newItemEditor');
    try {
        const json = JSON.parse(editor.value);
        editor.value = JSON.stringify(json, null, 2);
        showNotification('success', 'JSON formaté');
    } catch (e) {
        showNotification('error', 'JSON invalide');
    }
}

function validateJSON() {
    const editor = document.getElementById('jsonEditor');
    try {
        JSON.parse(editor.value);
        showNotification('success', 'JSON valide');
    } catch (e) {
        showNotification('error', `JSON invalide: ${e.message}`);
    }
}

// Notification system
function showNotification(type, message) {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Close modals on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}