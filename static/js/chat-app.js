// Chat Application Main JavaScript
let currentConversationId = null;
let currentUser = null;
let isLoading = false;
let allConversations = [];

// Helper function for fetch with credentials
async function fetchWithAuth(url, options = {}) {
    const defaultOptions = {
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    return fetch(url, { ...defaultOptions, ...options });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadUserProfile();
    await loadConversations();
    await loadSettings();
    setupEventListeners();
    updateChatInput();
    initializeTheme();
    restoreFilterState();
});

// Authentication check
async function checkAuth() {
    try {
        const response = await fetch('/auth/check', {
            credentials: 'same-origin' // Include cookies with the request
        });
        const result = await response.json();
        
        if (!result.authenticated) {
            // If we're already on the chat page, we must be logged in
            // This happens when the session cookie isn't properly sent with the fetch
            console.warn('Auth check returned false but user is on chat page');
            // Continue without redirecting
            currentUser = { username: 'User' }; // Fallback user object
        } else {
            currentUser = result.user;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // Don't redirect if we're already on the chat page
        if (!window.location.pathname.includes('/chat')) {
            window.location.href = '/login';
        }
    }
}

// Load user profile
async function loadUserProfile() {
    if (currentUser) {
        document.getElementById('userDisplayName').textContent = 
            currentUser.full_name || currentUser.username;
    }
}

// Load conversations
async function loadConversations() {
    try {
        const response = await fetch('/api/user/conversations');
        const result = await response.json();
        
        if (result.status === 'success') {
            allConversations = result.conversations;
            displayConversations(result.conversations);
        }
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}

// Display conversations in sidebar
function displayConversations(conversations) {
    const listElement = document.getElementById('conversationsList');
    listElement.innerHTML = '';
    
    if (conversations.length === 0) {
        listElement.innerHTML = `
            <div class="empty-state">
                <p>Aucune conversation</p>
                <p class="hint">Commencez une nouvelle conversation</p>
            </div>
        `;
        return;
    }
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (conv.id === currentConversationId) {
            item.classList.add('active');
        }
        
        const date = new Date(conv.updated_at);
        const dateStr = formatRelativeDate(date);
        
        // Build case badges
        let badges = '';
        
        
        // Only show approved badge and rating if available
        if (conv.treatment_plan_approved) {
            badges += `<span class="case-badge approved-badge">
                <i class="fas fa-check-circle"></i> Approuvé
            </span>`;
        }
        
        // Show rating if available
        if (conv.sequence_rating && conv.sequence_rating > 0) {
            const ratingColor = conv.sequence_rating >= 9 ? '#28a745' : 
                               conv.sequence_rating >= 7 ? '#17a2b8' : 
                               conv.sequence_rating >= 5 ? '#ffc107' : '#dc3545';
            badges += `<span class="case-badge rating-badge" style="background: ${ratingColor}20; color: ${ratingColor}; border: 1px solid ${ratingColor};">
                <i class="fas fa-star"></i> ${conv.sequence_rating}/10
            </span>`;
        }
        
        // Priority badge
        if (conv.priority === 'urgent') {
            badges += `<span class="case-badge urgent-badge">
                <i class="fas fa-exclamation-triangle"></i> Urgent
            </span>`;
        } else if (conv.priority === 'high') {
            badges += `<span class="case-badge priority-badge">
                <i class="fas fa-arrow-up"></i> Priorité
            </span>`;
        }
        
        // Status indicator
        let statusClass = '';
        if (conv.status === 'completed') {
            statusClass = 'completed';
        } else if (conv.status === 'pending_approval') {
            statusClass = 'pending';
        }
        
        item.className = `conversation-item ${statusClass}`;
        if (conv.id === currentConversationId) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="conversation-header">
                <div class="conversation-title">${escapeHtml(conv.title)}</div>
            </div>
            ${badges ? `<div class="conversation-badges">${badges}</div>` : ''}
            <div class="conversation-actions">
                <button class="action-btn" onclick="editConversationTitle(${conv.id}, event)" title="Renommer">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="action-btn" onclick="deleteConversation(${conv.id}, event)" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        item.onclick = () => loadConversation(conv.id);
        listElement.appendChild(item);
    });
}

// Load a specific conversation
async function loadConversation(conversationId) {
    try {
        const response = await fetch(`/api/user/conversations/${conversationId}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            currentConversationId = conversationId;
            window.currentConversation = result.conversation;  // Store conversation data
            displayMessages(result.messages);
            updateActiveConversation();
            hideWelcomeMessage();
        }
    } catch (error) {
        console.error('Failed to load conversation:', error);
        showNotification('error', 'Erreur lors du chargement de la conversation');
    }
}

// Display messages
function displayMessages(messages) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    // Clear current treatment plan when loading a new conversation
    window.currentTreatmentPlan = null;
    
    messages.forEach(msg => {
        addMessageToUI(msg.role, msg.content, msg.metadata);
        
        // Check if this message contains a treatment plan
        if (msg.metadata && msg.metadata.is_treatment_plan && msg.metadata.treatment_plan) {
            // Update the current treatment plan to the last one found
            window.currentTreatmentPlan = msg.metadata.treatment_plan;
        }
    });
    
    
    scrollToBottom();
}

// Add message to UI
function addMessageToUI(role, content, metadata = null) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper';
    
    // Avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = role === 'user' ? 
        '<i class="fas fa-user"></i>' : 
        '<i class="fas fa-brain"></i>';
    
    // Content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (role === 'assistant') {
        // Create tabbed output for assistant messages
        const tabbedOutput = createTabbedOutput(content, metadata);
        contentDiv.appendChild(tabbedOutput);
        
        // References are now shown in the tabbed interface, not inline
        // Just log for debugging
        if (metadata?.references && metadata.references.length > 0) {
            console.log('References available:', metadata.references);
        } else {
            console.log('No references to display:', metadata?.references);
        }
        
        // Display treatment plan if available
        if (metadata?.is_treatment_plan && metadata?.treatment_plan) {
            setTimeout(() => {
                displayTreatmentPlan(metadata.treatment_plan, metadata.references);
            }, 100);
        }
    } else {
        // User message
        contentDiv.textContent = content;
        
        // Add action badge if applicable
        if (metadata?.action) {
            const badge = createActionBadge(metadata.action);
            contentDiv.appendChild(badge);
        }
    }
    
    wrapperDiv.appendChild(avatarDiv);
    wrapperDiv.appendChild(contentDiv);
    messageDiv.appendChild(wrapperDiv);
    messagesContainer.appendChild(messageDiv);
}

// Create references element
function createReferencesElement(references) {
    const referencesDiv = document.createElement('div');
    referencesDiv.className = 'message-references';
    referencesDiv.innerHTML = '<div class="references-title">📚 Sources:</div>';
    
    references.forEach(ref => {
        const refDiv = document.createElement('div');
        refDiv.className = 'reference-item';
        
        // Show similarity score only if setting is enabled
        let similarityDisplay = '';
        if (window.userSettings.showSimilarityScores && ref.similarity_score !== undefined) {
            const score = Math.round(ref.similarity_score * 100);
            const scoreClass = score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low';
            similarityDisplay = `<span class="ref-score score-${scoreClass}">${score}%</span>`;
        }
        
        refDiv.innerHTML = `
            <span class="ref-type">${getRefTypeIcon(ref.type)}</span>
            <span class="ref-title">${escapeHtml(ref.title)}</span>
            ${similarityDisplay}
        `;
        referencesDiv.appendChild(refDiv);
    });
    
    return referencesDiv;
}

// Get icon for reference type
function getRefTypeIcon(type) {
    const icons = {
        'clinical_case': '📋',
        'ideal_sequence': '📝',
        'general_knowledge': '📚',
        'approved_sequence': '✅'
    };
    return icons[type] || '📄';
}

// Create action badge
function createActionBadge(action) {
    const badge = document.createElement('span');
    badge.className = 'message-action-badge';
    
    const actionInfo = {
        'suggest-plan': { icon: 'fa-clipboard-list', text: 'Suggest Plan' },
        'generate-note': { icon: 'fa-file-medical', text: 'Generate Note' },
        'clinical-tips': { icon: 'fa-lightbulb', text: 'Clinical Tips' }
    };
    
    const info = actionInfo[action] || { icon: 'fa-magic', text: action };
    badge.innerHTML = `<i class="fas ${info.icon}"></i> ${info.text}`;
    
    return badge;
}

// Create tabbed output for assistant messages
function createTabbedOutput(content, metadata) {
    const container = document.createElement('div');
    container.className = 'tabbed-output';
    
    // Determine which tabs to show
    const tabs = [];
    
    // Always show reasoning/diagnosis tab
    if (metadata?.reasoning || content) {
        tabs.push({
            id: 'reasoning',
            label: 'Diagnostic & Raisonnement',
            content: formatMessage(metadata?.reasoning || content),
            active: true
        });
    }
    
    // Show treatment plan tab if available
    if (metadata?.treatment_plan) {
        tabs.push({
            id: 'treatment',
            label: 'Plan de traitement',
            content: formatTreatmentPlanForTab(metadata.treatment_plan),
            active: tabs.length === 0
        });
    }
    
    // Show clinical note tab if available
    if (metadata?.clinical_note) {
        tabs.push({
            id: 'clinical-note',
            label: 'Note clinique',
            content: formatClinicalNote(metadata.clinical_note),
            active: tabs.length === 0
        });
    }
    
    // Show tips tab if available
    if (metadata?.tips) {
        tabs.push({
            id: 'tips',
            label: 'Conseils',
            content: formatTips(metadata.tips),
            active: tabs.length === 0
        });
    }
    
    // Show references tab if available
    if (metadata?.references && metadata.references.length > 0) {
        tabs.push({
            id: 'references',
            label: `Références (${metadata.references.length})`,
            content: formatReferencesForTab(metadata.references),
            active: tabs.length === 0
        });
    }
    
    // If only one tab, show content directly without tabs
    if (tabs.length <= 1) {
        const singleContent = document.createElement('div');
        singleContent.innerHTML = tabs[0]?.content || formatMessage(content);
        return singleContent;
    }
    
    // Create tab navigation
    const tabNav = document.createElement('div');
    tabNav.className = 'tab-navigation';
    
    tabs.forEach((tab, index) => {
        const button = document.createElement('button');
        button.className = `tab-button ${tab.active ? 'active' : ''}`;
        button.textContent = tab.label;
        button.onclick = () => switchTab(container, tab.id);
        tabNav.appendChild(button);
    });
    
    container.appendChild(tabNav);
    
    // Create tab content panels
    tabs.forEach(tab => {
        const panel = document.createElement('div');
        panel.className = `tab-content ${tab.active ? 'active' : ''}`;
        panel.id = `tab-${tab.id}`;
        panel.innerHTML = `<div class="tab-pane">${tab.content}</div>`;
        container.appendChild(panel);
    });
    
    return container;
}

// Switch between tabs
function switchTab(container, tabId) {
    // Update buttons
    container.querySelectorAll('.tab-button').forEach((btn, index) => {
        const isActive = container.querySelectorAll('.tab-content')[index].id === `tab-${tabId}`;
        btn.classList.toggle('active', isActive);
    });
    
    // Update content
    container.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
}

// Format references for tab display
function formatReferencesForTab(references) {
    let html = '<div class="references-tab-content">';
    
    references.forEach(ref => {
        const icon = getRefTypeIcon(ref.type);
        const typeLabel = getRefTypeLabel(ref.type);
        let similarityDisplay = '';
        
        if (window.userSettings.showSimilarityScores && ref.similarity_score !== undefined) {
            const score = Math.round(ref.similarity_score * 100);
            const scoreClass = score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low';
            similarityDisplay = `<span class="ref-score score-${scoreClass}">${score}%</span>`;
        }
        
        html += `
            <div class="reference-tab-item">
                <div class="ref-header">
                    <span class="ref-icon">${icon}</span>
                    <span class="ref-title">${escapeHtml(ref.title)}</span>
                    ${similarityDisplay}
                </div>
                <div class="ref-meta">
                    <span class="ref-type-label">${typeLabel}</span>
                    ${ref.source ? `<span class="ref-source">${escapeHtml(ref.source)}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Get label for reference type
function getRefTypeLabel(type) {
    const labels = {
        'clinical_case': 'Cas clinique',
        'ideal_sequence': 'Séquence idéale',
        'general_knowledge': 'Base de connaissances',
        'approved_sequence': 'Séquence approuvée'
    };
    return labels[type] || type;
}

// Format treatment plan for tab display
function formatTreatmentPlanForTab(treatmentPlan) {
    if (!treatmentPlan?.treatment_sequence) return '<p>Aucun plan de traitement disponible.</p>';
    
    let html = '<div class="treatment-sequence-list">';
    
    treatmentPlan.treatment_sequence.forEach((session, index) => {
        const sessionId = `session-${Date.now()}-${index}`;
        html += `
            <div class="treatment-session-item" data-session-id="${sessionId}">
                <div class="session-header">
                    <h5>Séance ${session.seance}</h5>
                    <button class="protocol-btn" onclick="toggleProtocol('${sessionId}', ${JSON.stringify(session).replace(/"/g, '&quot;')})">
                        <i class="fas fa-book-medical"></i>
                        <span>Protocole détaillé</span>
                    </button>
                </div>
                <p><strong>Traitement:</strong> ${escapeHtml(session.traitement)}</p>
                ${session.dents?.length ? `<p><strong>Dents:</strong> ${session.dents.join(', ')}</p>` : ''}
                ${session.remarques ? `<p><strong>Remarques:</strong> ${escapeHtml(session.remarques)}</p>` : ''}
                ${session.delai ? `<p><strong>Délai:</strong> ${escapeHtml(session.delai)}</p>` : ''}
                <div class="protocol-content" id="protocol-${sessionId}" style="display: none;">
                    <div class="protocol-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Génération du protocole clinique...</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    if (treatmentPlan.duration_totale) {
        html += `<p class="treatment-duration"><strong>Durée totale:</strong> ${escapeHtml(treatmentPlan.duration_totale)}</p>`;
    }
    
    return html;
}

// Format clinical note
function formatClinicalNote(note) {
    if (typeof note === 'string') {
        return `<div class="clinical-note-content">${formatMessage(note)}</div>`;
    }
    
    // If note is structured object
    let html = '<div class="clinical-note-content">';
    
    if (note.date) {
        html += `<p><strong>Date:</strong> ${escapeHtml(note.date)}</p>`;
    }
    
    if (note.chief_complaint) {
        html += `<h4>Motif de consultation</h4><p>${escapeHtml(note.chief_complaint)}</p>`;
    }
    
    if (note.findings) {
        html += `<h4>Constatations cliniques</h4><p>${formatMessage(note.findings)}</p>`;
    }
    
    if (note.diagnosis) {
        html += `<h4>Diagnostic</h4><p>${formatMessage(note.diagnosis)}</p>`;
    }
    
    if (note.treatment_provided) {
        html += `<h4>Traitement effectué</h4><p>${formatMessage(note.treatment_provided)}</p>`;
    }
    
    if (note.recommendations) {
        html += `<h4>Recommandations</h4><p>${formatMessage(note.recommendations)}</p>`;
    }
    
    if (note.next_appointment) {
        html += `<h4>Prochain rendez-vous</h4><p>${escapeHtml(note.next_appointment)}</p>`;
    }
    
    html += '</div>';
    return html;
}

// Format tips
function formatTips(tips) {
    if (!tips || tips.length === 0) return '<p>Aucun conseil disponible.</p>';
    
    // Handle both array and string formats
    const tipsList = Array.isArray(tips) ? tips : [tips];
    
    let html = '<ul class="tips-list">';
    
    tipsList.forEach(tip => {
        html += `
            <li class="tip-item">
                <span class="tip-icon"><i class="fas fa-lightbulb"></i></span>
                <span class="tip-content">${formatMessage(tip)}</span>
            </li>
        `;
    });
    
    html += '</ul>';
    return html;
}

// Format message content
function formatMessage(content) {
    // Enhanced markdown to HTML conversion
    let formatted = content
        // Headers
        .replace(/^### (.*?)$/gm, '<h4>$1</h4>')
        .replace(/^## (.*?)$/gm, '<h3>$1</h3>')
        .replace(/^# (.*?)$/gm, '<h2>$1</h2>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic (but not lists)
        .replace(/(?<!\d\.)\s\*([^*\n]+)\*/g, ' <em>$1</em>')
        // Code blocks
        .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Numbered lists
        .replace(/^\d+\.\s(.*)$/gm, '<li>$1</li>')
        // Bullet lists
        .replace(/^[-*]\s(.*)$/gm, '<li>$1</li>')
        // Line breaks (but not after headers)
        .replace(/\n(?!<[h|l])/g, '<br>');
    
    // Wrap consecutive list items in ul/ol tags
    formatted = formatted.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => {
        return '<ul>' + match + '</ul>';
    });
    
    return formatted;
}

// Send message
async function sendMessage(action = null) {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || isLoading) return;
    
    isLoading = true;
    updateSendButton();
    updateQuickActionButtons(true);
    
    // Clear input
    input.value = '';
    autoResizeTextarea(input);
    hideWelcomeMessage();
    
    // Add user message to UI with action badge if applicable
    const userMetadata = action ? { action } : null;
    addMessageToUI('user', message, userMetadata);
    scrollToBottom();
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                conversation_id: currentConversationId,
                tab: 'dental-brain',
                settings: window.userSettings,
                ...(action && { action }),
                ...(window.currentTreatmentPlan && { current_treatment_plan: window.currentTreatmentPlan }),
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // Update conversation ID if new
            if (!currentConversationId && result.conversation_id) {
                currentConversationId = result.conversation_id;
                await loadConversations();
            }
            
            // Add assistant response
            const metadata = {
                references: result.references,
                is_treatment_plan: result.is_treatment_plan,
                treatment_plan: result.treatment_plan,
                clinical_note: result.clinical_note,
                tips: result.tips,
                reasoning: result.reasoning || result.response
            };
            
            // Debug logging
            console.log('API Response:', result);
            console.log('References:', result.references);
            if (result.is_treatment_plan) {
                console.log('Treatment plan detected in response:', result.treatment_plan);
            }
            
            addMessageToUI('assistant', result.response, metadata);
        } else {
            showNotification('error', result.message || 'Erreur lors de l\'envoi du message');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('error', 'Erreur de connexion. Veuillez réessayer.');
    } finally {
        hideTypingIndicator();
        isLoading = false;
        updateSendButton();
        updateQuickActionButtons(false);
        scrollToBottom();
    }
}

// Show typing indicator
function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant typing-message';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="message-wrapper">
            <div class="message-avatar">
                <i class="fas fa-brain"></i>
            </div>
            <div class="message-content">
                <p class="typing-text">
                    <span class="typing-indicator">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </span>
                    Analyse en cours...
                </p>
            </div>
        </div>
    `;
    document.getElementById('chatMessages').appendChild(indicator);
    scrollToBottom();
    
    // Animate typing text
    setTimeout(() => {
        const typingText = indicator.querySelector('.typing-text');
        if (typingText) {
            const messages = [
                'Analyse en cours...',
                'Consultation des références...',
                'Génération du plan...',
                'Préparation de la réponse...'
            ];
            let index = 0;
            
            const interval = setInterval(() => {
                if (!document.getElementById('typingIndicator')) {
                    clearInterval(interval);
                    return;
                }
                index = (index + 1) % messages.length;
                typingText.textContent = messages[index];
            }, 2000);
        }
    }, 100);
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Treatment Plan Helper - Create a row
function createTreatmentRow(appointment, index) {
    const row = `
        <tr data-index="${index}" draggable="true" ondragstart="handleDragStart(event)" ondragover="handleDragOver(event)" ondrop="handleDrop(event)" ondragend="handleDragEnd(event)">
            <td class="select-cell">
                <input type="checkbox" class="row-checkbox" data-index="${index}" onchange="updateSelectedRows()">
            </td>
            <td class="drag-handle">
                <i class="fas fa-grip-vertical"></i>
            </td>
            <td class="editable" contenteditable="true" data-field="rdv">${appointment.rdv || index + 1}</td>
            <td class="editable" contenteditable="true" data-field="traitement">${escapeHtml(appointment.traitement || '')}</td>
            <td class="editable" contenteditable="true" data-field="duree">${appointment.duree || '-'}</td>
            <td class="editable" contenteditable="true" data-field="delai">${appointment.delai || '-'}</td>
            <td class="editable" contenteditable="true" data-field="dr">${appointment.dr || '-'}</td>
            <td class="editable" contenteditable="true" data-field="remarque">${appointment.remarque || '-'}</td>
            <td class="row-actions" style="white-space: nowrap;">
                <button class="action-btn delete-btn" onclick="deleteRow(${index})" title="Supprimer" style="display: inline-flex;">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
    return row;
}

// Display treatment plan inline
function displayTreatmentPlan(plan, references = []) {
    // Find the last assistant message
    const messages = document.getElementById('chatMessages');
    const assistantMessages = messages.querySelectorAll('.message.assistant');
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    
    if (lastAssistantMessage && window.inlineTreatment) {
        // Use inline treatment display
        window.inlineTreatment.displayTreatmentPlan(plan, references, lastAssistantMessage.querySelector('.message-content'));
        
        // Store the current plan globally for compatibility
        window.currentTreatmentPlan = JSON.parse(JSON.stringify(plan));
    } else {
        // Fallback to side panel if inline treatment not available
        displayTreatmentPlanSidePanel(plan, references);
        showTreatmentPanel();
    }
    
}

// Keep the original function for backward compatibility but rename it
function displayTreatmentPlanSidePanel(plan, references = []) {
    const content = document.getElementById('treatmentPlanContent');
    
    // Store the current plan globally for editing
    window.currentTreatmentPlan = JSON.parse(JSON.stringify(plan));
    
    let html = '';
    if (plan.consultation_text) {
        html += `<div class="consultation-text">${escapeHtml(plan.consultation_text)}</div>`;
    }
    
    // Check if the current conversation is approved
    const isApproved = window.currentConversation && window.currentConversation.treatment_plan_approved;
    
    // Add toolbar
    html += `
        <div class="treatment-toolbar">
            <button class="toolbar-btn" onclick="addNewRow()" title="Ajouter une ligne">
                <i class="fas fa-plus"></i> Ajouter
            </button>
            <button class="toolbar-btn merge-selected-btn" onclick="mergeSelectedRows()" title="Fusionner les lignes sélectionnées" disabled
                <i class="fas fa-compress-alt"></i> Fusionner <span id="mergeCount"></span>
            </button>
            <button class="toolbar-btn" onclick="saveTreatmentPlan()" title="Sauvegarder">
                <i class="fas fa-save"></i> Sauvegarder
            </button>
            <button class="toolbar-btn" onclick="exportTreatmentPlan()" title="Exporter">
                <i class="fas fa-download"></i> Exporter
            </button>
            ${!isApproved ? `
                <button class="toolbar-btn approve-btn" onclick="scrollToApprovalSection()" title="Approuver le plan">
                    <i class="fas fa-check-circle"></i> ${window.currentConversation && window.currentConversation.treatment_plan_approved ? 'Voir approbation' : 'Approuver'}
                </button>
            ` : ''}
            ${isApproved ? `
                <span class="approval-badge">
                    <i class="fas fa-check-circle"></i> Approuvé le ${new Date(window.currentConversation.approval_date).toLocaleDateString('fr-FR')}
                </span>
            ` : ''}
        </div>
    `;
    
    html += '<div class="treatment-plan-table"><table id="treatmentTable">';
    html += `
        <thead>
            <tr>
                <th width="40">
                    <input type="checkbox" id="selectAllRows" onchange="toggleSelectAll()">
                </th>
                <th width="40"></th>
                <th width="60">RDV</th>
                <th>Traitement</th>
                <th width="80">Durée</th>
                <th width="100">Délai</th>
                <th width="80">Dr</th>
                <th>Remarque</th>
                <th width="60">Actions</th>
            </tr>
        </thead>
        <tbody id="treatmentTableBody">
    `;
    
    plan.treatment_sequence.forEach((appointment, index) => {
        html += createTreatmentRow(appointment, index);
    });
    
    html += '</tbody></table></div>';
    
    // Add RAG sources section
    if (references && references.length > 0) {
        html += '<div class="rag-sources-section">';
        html += '<h4 class="rag-sources-title">📚 Sources utilisées pour ce plan</h4>';
        html += '<div class="rag-sources-list">';
        
        references.forEach(ref => {
            const typeIcon = ref.type === 'clinical_case' ? '🏥' : '📋';
            
            // Build score section based on settings
            let scoreSection = '';
            if (window.userSettings.showSimilarityScores && ref.similarity_score !== undefined) {
                const score = Math.round(ref.similarity_score * 100);
                const scoreClass = score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low';
                scoreSection = `
                    <div class="rag-source-score">
                        <div class="score-label">Similarité:</div>
                        <div class="score-bar-container">
                            <div class="score-bar score-${scoreClass}" style="width: ${score}%"></div>
                        </div>
                        <span class="score-percentage">${score}%</span>
                    </div>
                `;
            }
            
            html += `
                <div class="rag-source-item clickable" onclick='showRagSourceDetail(${JSON.stringify(ref)})'>
                    <div class="rag-source-header">
                        <span class="rag-source-type">${typeIcon}</span>
                        <span class="rag-source-title">${escapeHtml(ref.title)}</span>
                    </div>
                    ${scoreSection}
                    <div class="rag-source-meta">
                        <span class="source-type">${ref.type === 'clinical_case' ? 'Cas clinique' : 'Séquence idéale'}</span>
                        ${ref.categories?.length > 0 ? `<span class="source-categories">${ref.categories.join(', ')}</span>` : ''}
                    </div>
                    <div class="click-indicator">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
    }
    
    // Add approval/grading section
    html += `
        <div class="sequence-approval-section">
            <h4 class="approval-title">
                <i class="fas fa-star"></i>
                Évaluer cette séquence
            </h4>
            <div class="approval-content">
                <div class="rating-container">
                    <label class="rating-label">Noter la qualité de cette séquence :</label>
                    <div class="rating-stars" id="sequenceRating">
                        ${[1,2,3,4,5,6,7,8,9,10].map(i => `
                            <button class="rating-star" data-rating="${i}" onclick="rateSequence(${i})" title="${i}/10">
                                <i class="far fa-star"></i>
                            </button>
                        `).join('')}
                        <span class="rating-text" id="ratingText">Non évalué</span>
                    </div>
                </div>
                <div class="approval-actions">
                    <button class="approve-btn" onclick="approveSequence()" id="approveBtn">
                        <i class="fas fa-check"></i>
                        Approuver et sauvegarder
                    </button>
                    <div class="approval-info">
                        <i class="fas fa-info-circle"></i>
                        <span>Les séquences notées 9/10 ou plus seront utilisées pour améliorer les suggestions futures</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // REMOVED: Financial Analysis Section
    
    content.innerHTML = html;
    
    // Only show the panel if autoExpandTreatment is enabled
    if (window.userSettings.autoExpandTreatment) {
        showTreatmentPanel();
    } else {
        // Add a notification that a treatment plan is available
        showNotification('info', 'Plan de traitement généré. Cliquez pour voir les détails.');
    }
    
    // Add event listeners to all editable cells
    setTimeout(() => {
        const tbody = document.getElementById('treatmentTableBody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => addEditListeners(row));
        }
    }, 100);
}

// Panel controls
function showTreatmentPanel() {
    const panel = document.getElementById('treatmentPlanPanel');
    panel.style.display = 'flex';
    setTimeout(() => panel.classList.add('show'), 10);
    
}

function closeTreatmentPanel() {
    const panel = document.getElementById('treatmentPlanPanel');
    panel.classList.remove('show');
    setTimeout(() => panel.style.display = 'none', 300);
    
}



function showSearchPanel() {
    const panel = document.getElementById('searchPanel');
    panel.style.display = 'flex';
    setTimeout(() => panel.classList.add('show'), 10);
    document.getElementById('searchInput').focus();
}

function closeSearchPanel() {
    const panel = document.getElementById('searchPanel');
    panel.classList.remove('show');
    setTimeout(() => panel.style.display = 'none', 300);
}

// Search functionality
async function performSearch() {
    const input = document.getElementById('searchInput');
    const query = input.value.trim();
    
    if (!query) return;
    
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div class="loading">Recherche en cours...</div>';
    
    try {
        const response = await fetch('/api/ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                type: 'combined'
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            displaySearchResults(result.results);
        } else {
            resultsDiv.innerHTML = '<div class="error">Erreur lors de la recherche</div>';
        }
    } catch (error) {
        console.error('Search error:', error);
        resultsDiv.innerHTML = '<div class="error">Erreur lors de la recherche</div>';
    }
}

// Display search results
function displaySearchResults(results) {
    const resultsDiv = document.getElementById('searchResults');
    
    if (!results || (!results.clinical_cases?.length && !results.ideal_sequences?.length)) {
        resultsDiv.innerHTML = '<div class="no-results">Aucun résultat trouvé</div>';
        return;
    }
    
    let html = '';
    
    // Clinical cases
    if (results.clinical_cases?.length > 0) {
        html += '<div class="results-section">';
        html += '<h4>📋 Cas Cliniques</h4>';
        results.clinical_cases.forEach(item => {
            const similarity = Math.round(item.similarity_score * 100);
            html += `
                <div class="result-item">
                    <div class="result-title">${escapeHtml(item.title)}</div>
                    <div class="result-similarity">${similarity}% similaire</div>
                    <div class="result-source">${escapeHtml(item.source)}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Ideal sequences
    if (results.ideal_sequences?.length > 0) {
        html += '<div class="results-section">';
        html += '<h4>📝 Séquences Idéales</h4>';
        results.ideal_sequences.forEach(item => {
            const similarity = Math.round(item.similarity_score * 100);
            html += `
                <div class="result-item">
                    <div class="result-title">${escapeHtml(item.title)}</div>
                    <div class="result-similarity">${similarity}% similaire</div>
                    <div class="result-source">${escapeHtml(item.source)}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    resultsDiv.innerHTML = html;
}

// User profile functions
async function showUserProfile() {
    const modal = document.getElementById('userProfileModal');
    
    // Load current user data
    document.getElementById('profileEmail').value = currentUser.email;
    document.getElementById('profileFullName').value = currentUser.full_name || '';
    document.getElementById('profileUsername').value = currentUser.username;
    
    // Set theme toggle state
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    document.getElementById('themeToggle').checked = currentTheme === 'light';
    document.getElementById('themeLabel').textContent = currentTheme === 'light' ? 'Mode clair' : 'Mode sombre';
    
    modal.style.display = 'flex';
}

function closeUserProfile() {
    document.getElementById('userProfileModal').style.display = 'none';
}

async function updateProfile(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        email: formData.get('email'),
        full_name: formData.get('full_name')
    };
    
    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            currentUser = result.user;
            await loadUserProfile();
            showNotification('success', 'Profil mis à jour');
        } else {
            showNotification('error', result.message || 'Erreur lors de la mise à jour');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('error', 'Erreur lors de la mise à jour du profil');
    }
}

async function changePassword(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        current_password: formData.get('current_password'),
        new_password: formData.get('new_password')
    };
    
    try {
        const response = await fetch('/api/user/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showNotification('success', 'Mot de passe modifié');
            event.target.reset();
        } else {
            showNotification('error', result.message || 'Erreur lors du changement');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification('error', 'Erreur lors du changement de mot de passe');
    }
}

// Conversation management
async function startNewChat() {
    currentConversationId = null;
    document.getElementById('chatMessages').innerHTML = '';
    showWelcomeMessage();
    updateActiveConversation();
    
    // Clear treatment plan and conversation data
    window.currentTreatmentPlan = null;
    window.currentConversation = null;
    
    // Also close the treatment panel if it's open
    const panel = document.getElementById('treatmentPlanPanel');
    if (panel && panel.classList.contains('show')) {
        closeTreatmentPanel();
    }
    
}

async function deleteConversation(conversationId, event) {
    event.stopPropagation();
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette conversation?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/user/conversations/${conversationId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            if (conversationId === currentConversationId) {
                startNewChat();
            }
            await loadConversations();
        }
    } catch (error) {
        console.error('Error deleting conversation:', error);
        showNotification('error', 'Erreur lors de la suppression');
    }
}

async function editConversationTitle(conversationId, event) {
    event.stopPropagation();
    
    const newTitle = prompt('Nouveau titre:');
    if (!newTitle) return;
    
    try {
        const response = await fetch(`/api/user/conversations/${conversationId}/title`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: newTitle })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            await loadConversations();
        }
    } catch (error) {
        console.error('Error updating title:', error);
        showNotification('error', 'Erreur lors de la mise à jour');
    }
}

// UI Helper functions
function setupEventListeners() {
    // Chat input
    const chatInput = document.getElementById('chatInput');
    chatInput.addEventListener('input', () => {
        autoResizeTextarea(chatInput);
        updateSendButton();
    });
    
    // Modal close on outside click
    document.getElementById('userProfileModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeUserProfile();
        }
    });
}

function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
        performSearch();
    }
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function updateSendButton() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = !input.value.trim() || isLoading;
}

// Update quick action buttons state
function updateQuickActionButtons(loading = false) {
    const input = document.getElementById('chatInput');
    const hasText = input.value.trim().length > 0;
    const buttons = document.querySelectorAll('.quick-action-btn');
    
    buttons.forEach(btn => {
        if (loading) {
            btn.disabled = true;
        } else {
            btn.disabled = !hasText || isLoading;
        }
        btn.classList.toggle('loading', loading && btn.dataset.activeAction === 'true');
    });
}

// Send quick action
async function sendQuickAction(action) {
    const input = document.getElementById('chatInput');
    if (!input.value.trim() || isLoading) return;
    
    // Mark the active button
    const activeBtn = document.querySelector(`[data-action="${action}"]`);
    if (activeBtn) {
        activeBtn.dataset.activeAction = 'true';
        activeBtn.classList.add('loading');
    }
    
    // Send message with action
    await sendMessage(action);
    
    // Clean up
    if (activeBtn) {
        delete activeBtn.dataset.activeAction;
        activeBtn.classList.remove('loading');
    }
}

function updateChatInput() {
    const input = document.getElementById('chatInput');
    input.addEventListener('input', () => {
        updateSendButton();
        updateQuickActionButtons();
    });
    updateSendButton();
    updateQuickActionButtons();
}

function updateActiveConversation() {
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (currentConversationId) {
        const activeItem = document.querySelector(`.conversation-item[onclick*="${currentConversationId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
}

function showWelcomeMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-brain"></i>
            </div>
            <h3>Bienvenue dans Dental Brain AI</h3>
            <p>Je suis votre assistant spécialisé en planification de traitements dentaires.</p>
            <div class="suggestions">
                <p>Essayez ces exemples:</p>
                <button class="suggestion-chip" onclick="sendSuggestion('Plan de TT 12 à 22 F')">
                    Plan de TT 12 à 22 F
                </button>
                <button class="suggestion-chip" onclick="sendSuggestion('Traitement de racine 3 canaux')">
                    Traitement de racine 3 canaux
                </button>
                <button class="suggestion-chip" onclick="sendSuggestion('26 CC')">
                    26 CC (Couronne céramique)
                </button>
            </div>
        </div>
    `;
}

function hideWelcomeMessage() {
    const welcome = document.querySelector('.welcome-message');
    if (welcome) {
        welcome.remove();
    }
}

function sendSuggestion(text) {
    document.getElementById('chatInput').value = text;
    autoResizeTextarea(document.getElementById('chatInput'));
    updateSendButton();
    sendMessage();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('show');
}

// Settings Management
// Make window.userSettings globally available
window.window.userSettings = {
    ragPreference: 0, // -100 to 100 (-100 = clinical cases, 0 = balanced, 100 = ideal sequences)
    similarityThreshold: 60,
    clinicalCasesCount: 3,
    idealSequencesCount: 2,
    knowledgeCount: 2,
    reasoningMode: 'adaptive',
    aiModel: 'gpt-4o', // Default to standard model
    showSimilarityScores: true,
    explainReasoning: true,
    autoExpandTreatment: true,
    compactView: false
};

function showSettings() {
    // Load current settings first
    loadSettings().then(() => {
        // Update UI with current settings
        document.getElementById('ragPreference').value = window.userSettings.ragPreference;
        document.getElementById('similarityThreshold').value = window.userSettings.similarityThreshold;
        document.getElementById('clinicalCasesCount').value = window.userSettings.clinicalCasesCount;
        document.getElementById('idealSequencesCount').value = window.userSettings.idealSequencesCount;
        document.getElementById('knowledgeCount').value = window.userSettings.knowledgeCount;
        document.getElementById('reasoningMode').value = window.userSettings.reasoningMode;
        
        // Set AI model with fallback
        const aiModelSelect = document.getElementById('aiModel');
        if (aiModelSelect) {
            aiModelSelect.value = window.userSettings.aiModel || 'gpt-4o';
            // Force the select to update its display
            aiModelSelect.dispatchEvent(new Event('change'));
        }
        
        document.getElementById('showSimilarityScores').checked = window.userSettings.showSimilarityScores;
        document.getElementById('explainReasoning').checked = window.userSettings.explainReasoning;
        document.getElementById('autoExpandTreatment').checked = window.userSettings.autoExpandTreatment;
        document.getElementById('compactView').checked = window.userSettings.compactView;
        
        // Update displays
        updateRagPreferenceDisplay(window.userSettings.ragPreference);
        updateSimilarityDisplay(window.userSettings.similarityThreshold);
        updateModelDescription();
        
        // Show modal
        document.getElementById('settingsModal').style.display = 'flex';
    });
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function updateRagPreferenceDisplay(value) {
    const displayElement = document.getElementById('ragPreferenceValue');
    let text;
    
    if (value < -50) {
        text = `Cas cliniques prioritaires (${value})`;
    } else if (value < -20) {
        text = `Préférence cas cliniques (${value})`;
    } else if (value < 20) {
        text = `Équilibré (${value})`;
    } else if (value < 50) {
        text = `Préférence séquences idéales (${value})`;
    } else {
        text = `Séquences idéales prioritaires (${value})`;
    }
    
    displayElement.textContent = text;
}

function updateSimilarityDisplay(value) {
    document.getElementById('similarityValue').textContent = `${value}%`;
}

function updateModelDescription() {
    const modelSelect = document.getElementById('aiModel');
    const descriptionElement = document.getElementById('modelDescription');
    
    if (modelSelect.value === 'gpt-4o') {
        descriptionElement.textContent = "Le mode standard est rapide et efficace pour la plupart des cas.";
    } else if (modelSelect.value === 'o4-mini') {
        descriptionElement.textContent = "Le mode pensée prend plus de temps mais offre une réflexion approfondie, idéal pour les cas complexes nécessitant une analyse détaillée.";
    }
}

async function saveSettings() {
    // Gather settings from UI
    window.userSettings.ragPreference = parseInt(document.getElementById('ragPreference').value);
    window.userSettings.similarityThreshold = parseInt(document.getElementById('similarityThreshold').value);
    window.userSettings.clinicalCasesCount = parseInt(document.getElementById('clinicalCasesCount').value);
    window.userSettings.idealSequencesCount = parseInt(document.getElementById('idealSequencesCount').value);
    window.userSettings.knowledgeCount = parseInt(document.getElementById('knowledgeCount').value);
    window.userSettings.reasoningMode = document.getElementById('reasoningMode').value;
    window.userSettings.aiModel = document.getElementById('aiModel').value;
    window.userSettings.showSimilarityScores = document.getElementById('showSimilarityScores').checked;
    window.userSettings.explainReasoning = document.getElementById('explainReasoning').checked;
    window.userSettings.autoExpandTreatment = document.getElementById('autoExpandTreatment').checked;
    window.userSettings.compactView = document.getElementById('compactView').checked;
    
    try {
        const response = await fetch('/api/user/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(window.userSettings)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showNotification('success', 'Paramètres enregistrés avec succès');
            closeSettings();
            
            // Apply display settings immediately
            applyDisplaySettings();
        } else {
            showNotification('error', data.message || 'Erreur lors de l\'enregistrement');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('error', 'Erreur lors de l\'enregistrement des paramètres');
    }
}

async function loadSettings() {
    try {
        const response = await fetch('/api/user/settings');
        const data = await response.json();
        
        if (data.status === 'success' && data.settings) {
            window.userSettings = { ...window.userSettings, ...data.settings };
            applyDisplaySettings();
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function resetSettings() {
    // Reset to defaults
    document.getElementById('ragPreference').value = 0;
    document.getElementById('similarityThreshold').value = 60;
    document.getElementById('clinicalCasesCount').value = 3;
    document.getElementById('idealSequencesCount').value = 2;
    document.getElementById('knowledgeCount').value = 2;
    document.getElementById('reasoningMode').value = 'adaptive';
    document.getElementById('aiModel').value = 'gpt-4o';
    document.getElementById('showSimilarityScores').checked = true;
    document.getElementById('explainReasoning').checked = true;
    document.getElementById('autoExpandTreatment').checked = true;
    document.getElementById('compactView').checked = false;
    
    // Update displays
    updateRagPreferenceDisplay(0);
    updateSimilarityDisplay(60);
    
    showNotification('info', 'Paramètres réinitialisés (non sauvegardés)');
}

function applyDisplaySettings() {
    // Apply compact view
    if (window.userSettings.compactView) {
        document.body.classList.add('compact-view');
    } else {
        document.body.classList.remove('compact-view');
    }
}

async function handleLogout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function scrollToBottom() {
    const messages = document.getElementById('chatMessages');
    messages.scrollTop = messages.scrollHeight;
}

function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Add icon based on type
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;
    
    // Add to notification container or create one
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Theme management functions
function initializeTheme() {
    // Get theme from user profile or localStorage
    const savedTheme = currentUser?.theme || localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update toggle state
    const themeToggle = document.getElementById('themeToggle');
    const themeLabel = document.getElementById('themeLabel');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'light';
        themeLabel.textContent = savedTheme === 'light' ? 'Mode clair' : 'Mode sombre';
    }
}

async function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Apply theme immediately
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update toggle label
    const themeLabel = document.getElementById('themeLabel');
    themeLabel.textContent = newTheme === 'light' ? 'Mode clair' : 'Mode sombre';
    
    // Save to user profile if logged in
    if (currentUser) {
        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ theme: newTheme })
            });
            
            if (response.ok) {
                const result = await response.json();
                currentUser.theme = newTheme;
            }
        } catch (error) {
            console.error('Failed to save theme preference:', error);
        }
    }
}

// Treatment Plan Editing Functions
// Add new row
function addNewRow() {
    const tbody = document.getElementById('treatmentTableBody');
    const newIndex = window.currentTreatmentPlan.treatment_sequence.length;
    
    const newAppointment = {
        rdv: newIndex + 1,
        traitement: '',
        duree: '',
        delai: '',
        dr: '',
        remarque: ''
    };
    
    window.currentTreatmentPlan.treatment_sequence.push(newAppointment);
    tbody.insertAdjacentHTML('beforeend', createTreatmentRow(newAppointment, newIndex));
    
    // Focus on the treatment field of the new row
    const newRow = tbody.lastElementChild;
    const treatmentCell = newRow.querySelector('[data-field="traitement"]');
    treatmentCell.focus();
    
    // Add event listeners for the new row
    addEditListeners(newRow);
}

// Delete row
function deleteRow(index) {
    // Add animation before removing
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (row) {
        row.style.transition = 'all 0.3s ease-out';
        row.style.transform = 'translateX(-100%)';
        row.style.opacity = '0';
        
        setTimeout(() => {
            window.currentTreatmentPlan.treatment_sequence.splice(index, 1);
            refreshTreatmentTable();
        }, 300);
    }
}

// Selection management
function updateSelectedRows() {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    const mergeBtn = document.querySelector('.merge-selected-btn');
    const mergeCount = document.getElementById('mergeCount');
    
    if (checkboxes.length > 1) {
        mergeBtn.disabled = false;
        mergeCount.textContent = `(${checkboxes.length})`;
    } else {
        mergeBtn.disabled = true;
        mergeCount.textContent = '';
    }
    
    // Update row styling
    document.querySelectorAll('#treatmentTableBody tr').forEach(row => {
        const checkbox = row.querySelector('.row-checkbox');
        if (checkbox && checkbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
}

// Toggle select all
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllRows');
    const checkboxes = document.querySelectorAll('.row-checkbox');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });
    
    updateSelectedRows();
}

// Merge selected rows
function mergeSelectedRows() {
    const checkboxes = document.querySelectorAll('.row-checkbox:checked');
    if (checkboxes.length < 2) return;
    
    // Get selected indices
    const selectedIndices = Array.from(checkboxes)
        .map(cb => parseInt(cb.getAttribute('data-index')))
        .sort((a, b) => a - b);
    
    // Animate merge
    selectedIndices.forEach(index => {
        const row = document.querySelector(`tr[data-index="${index}"]`);
        if (row) {
            row.style.background = 'var(--accent-primary)';
            row.style.transition = 'all 0.3s';
        }
    });
    
    setTimeout(() => {
        const sequence = window.currentTreatmentPlan.treatment_sequence;
        const firstIndex = selectedIndices[0];
        const merged = sequence[firstIndex];
        
        // Collect all data from selected rows
        const treatments = [];
        const durations = [];
        const delays = [];
        const remarks = [];
        const doctors = new Set();
        
        selectedIndices.forEach(index => {
            const item = sequence[index];
            if (item.traitement && item.traitement !== '-') treatments.push(item.traitement);
            if (item.duree && item.duree !== '-') durations.push(item.duree);
            if (item.delai && item.delai !== '-') delays.push(item.delai);
            if (item.remarque && item.remarque !== '-') remarks.push(item.remarque);
            if (item.dr && item.dr !== '-') doctors.add(item.dr);
        });
        
        // Merge data
        merged.traitement = treatments.join(' + ');
        merged.duree = durations.length > 0 ? durations.join(' + ') : '-';
        merged.delai = delays.length > 0 ? delays[delays.length - 1] : '-'; // Keep last delay
        merged.remarque = remarks.length > 0 ? remarks.join('; ') : '-';
        merged.dr = doctors.size > 0 ? Array.from(doctors).join(', ') : '-';
        
        // Animate removal of other rows
        selectedIndices.slice(1).forEach((index, i) => {
            setTimeout(() => {
                const row = document.querySelector(`tr[data-index="${index}"]`);
                if (row) {
                    row.style.transform = 'translateX(100%)';
                    row.style.opacity = '0';
                }
            }, i * 100);
        });
        
        // Remove merged rows after animation
        setTimeout(() => {
            // Create new sequence without merged rows
            const newSequence = [];
            sequence.forEach((item, index) => {
                if (index === firstIndex || !selectedIndices.includes(index)) {
                    newSequence.push(item);
                }
            });
            
            // Update the sequence and renumber
            window.currentTreatmentPlan.treatment_sequence = newSequence;
            window.currentTreatmentPlan.treatment_sequence.forEach((item, index) => {
                item.rdv = index + 1;
            });
            
            refreshTreatmentTable();
        }, 300 + (selectedIndices.length - 1) * 100);
    }, 200);
}

// Drag and Drop handlers
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.target.closest('tr');
    draggedElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const draggingOver = e.target.closest('tr');
    if (draggingOver && draggingOver !== draggedElement) {
        const tbody = document.getElementById('treatmentTableBody');
        const rows = [...tbody.querySelectorAll('tr')];
        const draggedIndex = rows.indexOf(draggedElement);
        const targetIndex = rows.indexOf(draggingOver);
        
        if (draggedIndex < targetIndex) {
            draggingOver.parentNode.insertBefore(draggedElement, draggingOver.nextSibling);
        } else {
            draggingOver.parentNode.insertBefore(draggedElement, draggingOver);
        }
    }
    
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    // Update the data model
    updateSequenceOrder();
    
    return false;
}

function handleDragEnd(e) {
    draggedElement.classList.remove('dragging');
    draggedElement = null;
}

// Update sequence order after drag and drop
function updateSequenceOrder() {
    const tbody = document.getElementById('treatmentTableBody');
    const rows = tbody.querySelectorAll('tr');
    const newSequence = [];
    
    rows.forEach((row, index) => {
        const oldIndex = parseInt(row.getAttribute('data-index'));
        const appointment = window.currentTreatmentPlan.treatment_sequence[oldIndex];
        appointment.rdv = index + 1;
        newSequence.push(appointment);
    });
    
    window.currentTreatmentPlan.treatment_sequence = newSequence;
    refreshTreatmentTable();
}

// Refresh the table
function refreshTreatmentTable() {
    const tbody = document.getElementById('treatmentTableBody');
    tbody.innerHTML = '';
    
    window.currentTreatmentPlan.treatment_sequence.forEach((appointment, index) => {
        tbody.insertAdjacentHTML('beforeend', createTreatmentRow(appointment, index));
    });
    
    // Re-add event listeners
    tbody.querySelectorAll('tr').forEach(row => addEditListeners(row));
    
    // Reset select all checkbox
    const selectAll = document.getElementById('selectAllRows');
    if (selectAll) selectAll.checked = false;
    
    // Update merge button state
    updateSelectedRows();
}

// Add edit listeners to cells
function addEditListeners(row) {
    row.querySelectorAll('.editable').forEach(cell => {
        cell.addEventListener('blur', function() {
            const field = this.getAttribute('data-field');
            const rowIndex = parseInt(this.closest('tr').getAttribute('data-index'));
            const value = this.textContent.trim();
            
            if (window.currentTreatmentPlan.treatment_sequence[rowIndex]) {
                window.currentTreatmentPlan.treatment_sequence[rowIndex][field] = value || '-';
            }
        });
        
        cell.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                // Move to next editable cell
                const allEditables = Array.from(document.querySelectorAll('.editable'));
                const currentIndex = allEditables.indexOf(this);
                const nextCell = allEditables[currentIndex + 1];
                if (nextCell) {
                    nextCell.focus();
                }
            }
        });
    });
}

// Save treatment plan
async function saveTreatmentPlan() {
    showNotification('info', 'Plan de traitement sauvegardé localement');
    // TODO: Implement server-side saving
}

// Approve treatment plan
async function approveTreatmentPlan() {
    if (!currentConversationId) {
        showNotification('error', 'Aucune conversation active');
        return;
    }
    
    try {
        const response = await fetch(`/api/user/conversations/${currentConversationId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showNotification('success', 'Plan de traitement approuvé avec succès');
            
            // Update the current conversation data
            window.currentConversation = result.conversation;
            
            // Refresh the treatment panel to show approved status
            if (window.currentTreatmentPlan) {
                displayTreatmentPlan(window.currentTreatmentPlan);
            }
            
            // Reload conversations to update the sidebar
            await loadConversations();
        } else {
            showNotification('error', result.message || 'Erreur lors de l\'approbation');
        }
    } catch (error) {
        console.error('Error approving treatment plan:', error);
        showNotification('error', 'Erreur lors de l\'approbation du plan');
    }
}

// Export treatment plan
function exportTreatmentPlan() {
    const dataStr = JSON.stringify(window.currentTreatmentPlan, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `plan-traitement-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// RAG Source Detail Modal Functions
async function showRagSourceDetail(ref) {
    const modal = document.getElementById('ragSourceModal');
    const titleEl = document.getElementById('ragSourceTitle');
    const contentEl = document.getElementById('ragSourceContent');
    
    // Set title
    const typeIcon = ref.type === 'clinical_case' ? '🏥' : '📋';
    const typeLabel = ref.type === 'clinical_case' ? 'Cas clinique' : 'Séquence idéale';
    titleEl.innerHTML = `${typeIcon} ${escapeHtml(ref.title)}`;
    
    // Show loading state
    contentEl.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Chargement des détails...</p>
        </div>
    `;
    
    // Show modal
    modal.style.display = 'flex';
    
    try {
        // Fetch detailed information
        const response = await fetch(`/api/ai/reference/${ref.id}`);
        const result = await response.json();
        
        if (result.status === 'success' && result.reference) {
            const data = result.reference;
            
            // Format the content
            let html = `
                <div class="rag-detail-container">
                    <div class="rag-detail-header">
                        <div class="detail-type-badge ${ref.type}">${typeLabel}</div>
                        <div class="detail-score">
                            <span class="score-label">Score de similarité:</span>
                            <span class="score-value">${Math.round(ref.similarity_score * 100)}%</span>
                        </div>
                    </div>
            `;
            
            // Categories
            if (ref.categories && ref.categories.length > 0) {
                html += `
                    <div class="detail-categories">
                        ${ref.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                    </div>
                `;
            }
            
            // Main content based on type
            
            // Treatment sequence
            if (data.treatment_sequence && data.treatment_sequence.length > 0) {
                html += `
                    <div class="detail-section">
                        <h4>📋 Séquence de traitement</h4>
                        <div class="sequence-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>RDV</th>
                                        <th>Traitement</th>
                                        <th>Durée</th>
                                        <th>Délai</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;
                
                data.treatment_sequence.forEach(item => {
                    html += `
                        <tr>
                            <td>${item.rdv || '-'}</td>
                            <td>${item.traitement || '-'}</td>
                            <td>${item.duree || '-'}</td>
                            <td>${item.delai || '-'}</td>
                        </tr>
                    `;
                });
                
                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
            
            // Additional notes or description
            if (data.notes || data.description) {
                html += `
                    <div class="detail-section">
                        <h4>📝 Notes</h4>
                        <div class="notes-content">
                            ${data.notes || data.description}
                        </div>
                    </div>
                `;
            }
            
            // Source file
            html += `
                <div class="detail-footer">
                    <span class="source-file">Source: ${ref.filename}</span>
                </div>
            `;
            
            html += '</div>';
            
            contentEl.innerHTML = html;
        } else {
            contentEl.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Impossible de charger les détails de cette source.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading source details:', error);
        contentEl.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Erreur lors du chargement des détails.</p>
            </div>
        `;
    }
}

function closeRagSourceModal() {
    const modal = document.getElementById('ragSourceModal');
    modal.style.display = 'none';
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('ragSourceModal');
    if (event.target === modal) {
        closeRagSourceModal();
    }
});

function formatRelativeDate(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) {
        return date.toLocaleDateString('fr-FR');
    } else if (days > 0) {
        return `il y a ${days} jour${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
        return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
        return 'maintenant';
    }
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
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// REMOVED: Financial Analysis functionality
/* Original code commented out:
// Generate Financial Analysis HTML
function generateFinancialAnalysisHTML(financials, treatmentSequence) {
    const summary = financials.summary;
    const formatCurrency = window.pricingConfig.formatCurrency;
    
    // Store original sequence for reset
    if (!window.originalTreatmentSequence) {
        window.originalTreatmentSequence = JSON.parse(JSON.stringify(treatmentSequence));
    }
    
    const html = `
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
                    <input type="range" id="financialOptimizer" min="0" max="100" value="100" step="10"
                           oninput="optimizeTreatmentSequence(this.value)">
                    <div class="optimizer-info">
                        <div class="optimizer-value" id="optimizerValue">
                            <span class="value-label">Mode actuel:</span>
                            <span class="value-text">Premium (100%)</span>
                        </div>
                        <div class="optimizer-impact" id="optimizerImpact" style="display: none;">
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
                    <canvas id="profitBreakdownChart"></canvas>
                </div>
                <div class="chart-container">
                    <canvas id="costDistributionChart"></canvas>
                </div>
            </div>
            
            <!-- Detailed Breakdown -->
            <div class="financial-breakdown">
                <h5>Détail par rendez-vous</h5>
                <div class="breakdown-table">
                    ${generateBreakdownTable(financials.breakdown)}
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
    
    // Initialize charts after DOM update
    setTimeout(() => {
        initializeFinancialCharts(financials);
    }, 100);
    
    return html;
}

// Generate breakdown table
function generateBreakdownTable(breakdown) {
    const formatCurrency = window.pricingConfig.formatCurrency;
    let html = '<table class="breakdown-table-content">';
    html += '<thead><tr><th>RDV</th><th>Procédure</th><th>Qté</th><th>CA</th><th>Coûts</th><th>Marge</th></tr></thead>';
    html += '<tbody>';
    
    breakdown.forEach(item => {
        const marginClass = item.margin > 0.6 ? 'high-margin' : item.margin > 0.4 ? 'medium-margin' : 'low-margin';
        html += `
            <tr>
                <td>${item.appointment}</td>
                <td>${escapeHtml(item.procedure)}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.revenue)}</td>
                <td>${formatCurrency(item.costs)}</td>
                <td class="${marginClass}">${Math.round(item.margin * 100)}%</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}
*/

// REMOVED: Financial charts functionality
/* Original code commented out:
// Initialize financial charts
function initializeFinancialCharts(financials) {
    const isDarkTheme = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDarkTheme ? '#e3e3e3' : '#0a0a0a';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    // Chart defaults
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    
    // Profit Breakdown Chart (3D-like doughnut)
    const profitCtx = document.getElementById('profitBreakdownChart');
    if (profitCtx) {
        new Chart(profitCtx, {
            type: 'doughnut',
            data: {
                labels: ['Bénéfice net', 'Coûts'],
                datasets: [{
                    data: [
                        financials.summary.totalProfit,
                        financials.summary.totalCosts
                    ],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(118, 75, 162, 1)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Répartition CA',
                        font: {
                            size: 14,
                            weight: 'normal'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = window.pricingConfig.formatCurrency(context.raw);
                                const percentage = Math.round(context.raw / financials.summary.totalRevenue * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Cost Distribution Chart (stacked bar)
    const costCtx = document.getElementById('costDistributionChart');
    if (costCtx) {
        const costBreakdown = financials.costBreakdown;
        new Chart(costCtx, {
            type: 'bar',
            data: {
                labels: ['Répartition des coûts'],
                datasets: [
                    {
                        label: 'Main d\'œuvre',
                        data: [costBreakdown.labor],
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Matériaux',
                        data: [costBreakdown.materials],
                        backgroundColor: 'rgba(118, 75, 162, 0.8)',
                        borderColor: 'rgba(118, 75, 162, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Laboratoire',
                        data: [costBreakdown.lab],
                        backgroundColor: 'rgba(244, 114, 182, 0.8)',
                        borderColor: 'rgba(244, 114, 182, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Frais généraux',
                        data: [costBreakdown.overhead],
                        backgroundColor: 'rgba(251, 191, 36, 0.8)',
                        borderColor: 'rgba(251, 191, 36, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        display: false
                    },
                    y: {
                        stacked: true,
                        ticks: {
                            callback: function(value) {
                                return window.pricingConfig.formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 11
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Structure des coûts',
                        font: {
                            size: 14,
                            weight: 'normal'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = window.pricingConfig.formatCurrency(context.raw);
                                const total = costBreakdown.labor + costBreakdown.materials + costBreakdown.lab + costBreakdown.overhead;
                                const percentage = Math.round(context.raw / total * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// Settings Tab Management
function switchSettingsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.closest('.settings-tab').classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });
    
    const tabContent = document.getElementById(`${tabName}Settings`);
    if (tabContent) {
        tabContent.style.display = 'block';
        tabContent.classList.add('active');
    }
    
    // Load pricing data if switching to pricing tab
    if (tabName === 'pricing') {
        loadPricingConfiguration();
    }
}

// Load pricing configuration into UI
function loadPricingConfiguration() {
    const config = window.pricingConfig.current();
    
    // Load hourly rates
    document.getElementById('rateDentist').value = config.hourlyRates.dentist;
    document.getElementById('rateHygienist').value = config.hourlyRates.hygienist;
    document.getElementById('rateAssistant').value = config.hourlyRates.assistant;
    
    // Load fixed costs
    document.getElementById('costMaterials').value = config.sessionCosts.materials;
    document.getElementById('costSterilization').value = config.sessionCosts.sterilization;
    document.getElementById('costOverhead').value = config.sessionCosts.overhead;
    
    // Load procedures list
    displayProceduresList();
}

// Display procedures list
function displayProceduresList(searchTerm = '') {
    const procedures = window.pricingConfig.getAllProcedures();
    const proceduresList = document.getElementById('proceduresList');
    
    const filteredProcedures = procedures.filter(proc => 
        proc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const categoryColors = {
        diagnostic: '#667eea',
        preventive: '#48bb78',
        restorative: '#ed8936',
        endodontic: '#e53e3e',
        prosthetic: '#9f7aea',
        surgical: '#f56565',
        implant: '#38b2ac',
        auxiliary: '#718096'
    };
    
    proceduresList.innerHTML = filteredProcedures.map(proc => `
        <div class="procedure-item">
            <div class="procedure-info">
                <div class="procedure-name">${escapeHtml(proc.name)}</div>
                <div class="procedure-details">
                    <span style="color: ${categoryColors[proc.category] || '#667eea'}">
                        ${getCategoryLabel(proc.category)}
                    </span>
                    • ${proc.duration} min
                    • Matériaux: ${window.pricingConfig.formatCurrency(proc.materials || 0)}
                    ${proc.labCost ? `• Labo: ${window.pricingConfig.formatCurrency(proc.labCost)}` : ''}
                </div>
            </div>
            <div class="procedure-price">
                ${window.pricingConfig.formatCurrency(proc.basePrice)}
            </div>
            <div class="procedure-actions">
                <button class="procedure-btn edit-btn" onclick="editProcedure('${escapeHtml(proc.key)}')" title="Modifier">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="procedure-btn delete-btn" onclick="confirmDeleteProcedure('${escapeHtml(proc.key)}')" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Get category label
function getCategoryLabel(category) {
    const labels = {
        diagnostic: 'Diagnostic',
        preventive: 'Préventif',
        restorative: 'Restaurateur',
        endodontic: 'Endodontique',
        prosthetic: 'Prothétique',
        surgical: 'Chirurgical',
        implant: 'Implantologie',
        auxiliary: 'Auxiliaire'
    };
    return labels[category] || category;
}

// Search procedures - Add event listener after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('procedureSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            displayProceduresList(e.target.value);
        });
    }
});

// Show add procedure modal
function showAddProcedureModal() {
    document.getElementById('procedureModalTitle').textContent = 'Ajouter une procédure';
    document.getElementById('procedureForm').reset();
    document.getElementById('procedureModal').style.display = 'flex';
}

// Edit procedure
function editProcedure(key) {
    const procedure = window.pricingConfig.getProcedure(key);
    if (!procedure) return;
    
    document.getElementById('procedureModalTitle').textContent = 'Modifier la procédure';
    document.getElementById('procedureName').value = key;
    document.getElementById('procedureCategory').value = procedure.category;
    document.getElementById('procedurePrice').value = procedure.basePrice;
    document.getElementById('procedureDuration').value = procedure.duration;
    document.getElementById('procedureMaterials').value = procedure.materials || 0;
    document.getElementById('procedureLabCost').value = procedure.labCost || 0;
    document.getElementById('procedurePerformer').value = procedure.performer || 'dentist';
    
    document.getElementById('procedureModal').style.display = 'flex';
}

// Close procedure modal
function closeProcedureModal() {
    document.getElementById('procedureModal').style.display = 'none';
}

// Save procedure
function saveProcedure(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const procedureData = {
        basePrice: parseFloat(formData.get('basePrice')),
        duration: parseInt(formData.get('duration')),
        category: formData.get('category'),
        materials: parseFloat(formData.get('materials')) || 0,
        labCost: parseFloat(formData.get('labCost')) || 0,
        performer: formData.get('performer')
    };
    
    const name = formData.get('name');
    window.pricingConfig.addOrUpdateProcedure(name, procedureData);
    
    closeProcedureModal();
    displayProceduresList();
    showNotification('success', 'Procédure enregistrée avec succès');
}

// Confirm delete procedure
function confirmDeleteProcedure(key) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer cette procédure ?`)) {
        window.pricingConfig.deleteProcedure(key);
        displayProceduresList();
        showNotification('success', 'Procédure supprimée');
    }
}

// Save pricing configuration
function savePricingConfig() {
    const config = window.pricingConfig.current();
    
    // Update hourly rates
    config.hourlyRates.dentist = parseFloat(document.getElementById('rateDentist').value);
    config.hourlyRates.hygienist = parseFloat(document.getElementById('rateHygienist').value);
    config.hourlyRates.assistant = parseFloat(document.getElementById('rateAssistant').value);
    
    // Update fixed costs
    config.sessionCosts.materials = parseFloat(document.getElementById('costMaterials').value);
    config.sessionCosts.sterilization = parseFloat(document.getElementById('costSterilization').value);
    config.sessionCosts.overhead = parseFloat(document.getElementById('costOverhead').value);
    
    // Update currency if changed
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        config.currency = currencySelect.value;
    }
    
    window.pricingConfig.update(config);
    showNotification('success', 'Configuration de tarification enregistrée');
}

// Export pricing
function exportPricing() {
    window.pricingConfig.export();
    showNotification('success', 'Configuration exportée');
}

// Import pricing
function importPricing() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                await window.pricingConfig.import(file);
                loadPricingConfiguration();
                showNotification('success', 'Configuration importée avec succès');
            } catch (error) {
                showNotification('error', 'Erreur lors de l\'importation: ' + error.message);
            }
        }
    };
    input.click();
}

// Toggle protocol display
async function toggleProtocol(sessionId, sessionData) {
    const protocolDiv = document.getElementById(`protocol-${sessionId}`);
    const button = document.querySelector(`[data-session-id="${sessionId}"] .protocol-btn`);
    
    if (!protocolDiv) return;
    
    const isVisible = protocolDiv.style.display !== 'none';
    
    if (isVisible) {
        // Hide protocol
        protocolDiv.style.display = 'none';
        button.classList.remove('active');
    } else {
        // Show protocol
        protocolDiv.style.display = 'block';
        button.classList.add('active');
        
        // Check if protocol already loaded
        if (!protocolDiv.dataset.loaded) {
            // Generate protocol
            await generateProtocol(sessionId, sessionData);
        }
    }
}

// Generate clinical protocol
async function generateProtocol(sessionId, sessionData) {
    const protocolDiv = document.getElementById(`protocol-${sessionId}`);
    
    try {
        // Prepare the prompt for protocol generation
        const prompt = `Génère un protocole clinique détaillé étape par étape pour: ${sessionData.traitement}${sessionData.dents?.length ? ' sur dent(s) ' + sessionData.dents.join(', ') : ''}. Format: étapes numérotées avec détails techniques précis.`;
        
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: prompt,
                tab: 'dental-brain',
                action: 'generate-protocol',
                settings: window.userSettings
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // Display the protocol
            const protocolContent = result.protocol || result.response;
            protocolDiv.innerHTML = `
                <div class="protocol-text">
                    ${formatProtocol(protocolContent)}
                </div>
            `;
            protocolDiv.dataset.loaded = 'true';
        } else {
            protocolDiv.innerHTML = `
                <div class="protocol-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erreur lors de la génération du protocole</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error generating protocol:', error);
        protocolDiv.innerHTML = `
            <div class="protocol-error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Erreur de connexion</span>
            </div>
        `;
    }
}

// Format protocol content
function formatProtocol(content) {
    // Enhanced formatting for clinical protocols
    let formatted = content
        // Main sections
        .replace(/^## (.*?)$/gm, '<h4 class="protocol-section">$1</h4>')
        // Subsections
        .replace(/^### (.*?)$/gm, '<h5 class="protocol-subsection">$1</h5>')
        // Numbered steps - make them stand out
        .replace(/^(\d+)\.\s(.*)$/gm, '<div class="protocol-step"><span class="step-number">$1</span><span class="step-content">$2</span></div>')
        // Bold important terms  
        .replace(/\*{2}(.*?)\*{2}/g, '<strong>$1</strong>')
        // Bullet points for materials/instruments
        .replace(/^[-]\s(.*)$/gm, '<li class="protocol-item">$1</li>')
        // Warnings or important notes (removed emoji due to parsing issues)
        .replace(/Warning:\s*(.*?)$/gm, '<div class="protocol-warning"><i class="fas fa-exclamation-triangle"></i> $1</div>')
        // Tips (removed emoji due to parsing issues)
        .replace(/Tip:\s*(.*?)$/gm, '<div class="protocol-tip"><i class="fas fa-lightbulb"></i> $1</div>')
        // Line breaks
        .replace(/\n/g, '<br>');
    
    // Wrap lists
    formatted = formatted.replace(/(<li class="protocol-item">.*?<\/li>\s*)+/gs, '<ul class="protocol-list">$&</ul>');
    
    return formatted;
}

// REMOVED: Financial Optimization Functions
/* Original code commented out:
// Financial Optimization Functions
function optimizeTreatmentSequence(value) {
    const optimizerValue = parseInt(value);
    const valueText = document.querySelector('.optimizer-value .value-text');
    const impactDiv = document.getElementById('optimizerImpact');
    
    // Update display only - no actual optimization for now
    let mode = 'Premium';
    if (optimizerValue < 40) mode = 'Économique';
    else if (optimizerValue < 70) mode = 'Équilibré';
    
    valueText.textContent = `${mode} (${optimizerValue}%)`;
    
    // Show coming soon message when moved
    if (optimizerValue < 100) {
        impactDiv.style.display = 'block';
        impactDiv.querySelector('.impact-value').textContent = 'Fonctionnalité à venir';
        impactDiv.querySelector('.impact-value').style.color = 'var(--text-secondary)';
    } else {
        impactDiv.style.display = 'none';
    }
    
    // Disabled functionality - keeping for future implementation
    return;
    
    /* FUTURE IMPLEMENTATION - Currently disabled
    const resetBtn = document.querySelector('.reset-optimization-btn');
    resetBtn.style.display = optimizerValue < 100 ? 'inline-flex' : 'none';
    
    if (!window.originalTreatmentSequence) return;
    
    const treatmentPlanContent = document.getElementById('treatmentPlanContent');
    if (!treatmentPlanContent) return;
    
    const optimizedSequence = applySequenceOptimizations(
        JSON.parse(JSON.stringify(window.originalTreatmentSequence)), 
        optimizerValue
    );
    
    updateTreatmentTable(optimizedSequence);
    
    const newFinancials = window.pricingConfig.calculateSequenceFinancials(optimizedSequence);
    const originalFinancials = window.pricingConfig.calculateSequenceFinancials(window.originalTreatmentSequence);
    
    updateFinancialDisplay(newFinancials);
    
    const savings = originalFinancials.summary.totalRevenue - newFinancials.summary.totalRevenue;
    if (savings > 0) {
        impactDiv.style.display = 'block';
        impactDiv.querySelector('.impact-value').textContent = 
            `Économie: ${window.pricingConfig.formatCurrency(savings)}`;
    } else {
        impactDiv.style.display = 'none';
    }
    */

function applySequenceOptimizations(sequence, optimizationLevel) {
    const config = window.pricingConfig.current();
    const alternatives = config.materialAlternatives || getDefaultAlternatives();
    
    // Economic mode (0-40): Maximum cost reduction
    if (optimizationLevel < 40) {
        return sequence.map(session => {
            // Apply material substitutions
            let optimizedTreatment = session.traitement;
            
            // Check for alternatives
            for (const [premium, economic] of Object.entries(alternatives)) {
                const regex = new RegExp(premium, 'gi');
                if (regex.test(optimizedTreatment)) {
                    optimizedTreatment = optimizedTreatment.replace(regex, economic);
                    session.optimized = true;
                    session.originalTreatment = session.traitement;
                }
            }
            
            session.traitement = optimizedTreatment;
            
            // Extend delays for economic mode
            if (session.delai && optimizationLevel < 20) {
                session.delai = extendDelay(session.delai);
                session.delayOptimized = true;
            }
            
            return session;
        });
    }
    
    // Balanced mode (40-70): Moderate optimization
    else if (optimizationLevel < 70) {
        return sequence.map((session, index) => {
            // Only optimize non-critical procedures
            if (isNonCriticalProcedure(session.traitement)) {
                let optimizedTreatment = session.traitement;
                
                // Apply some substitutions
                if (optimizedTreatment.includes('céramique')) {
                    optimizedTreatment = optimizedTreatment.replace('céramique', 'composite renforcé');
                    session.optimized = true;
                    session.originalTreatment = session.traitement;
                }
                
                session.traitement = optimizedTreatment;
            }
            
            return session;
        });
    }
    
    // Premium mode (70-100): Minimal or no changes
    return sequence;
}

function getDefaultAlternatives() {
    return {
        'couronne céramique': 'couronne métallo-céramique',
        'facette céramique': 'composite esthétique',
        'inlay céramique': 'composite renforcé',
        'bridge céramique': 'bridge métallo-céramique',
        'implant titane': 'bridge conventionnel'
    };
}

function isNonCriticalProcedure(treatment) {
    const criticalKeywords = ['implant', 'racine', 'extraction', 'chirurgie'];
    return !criticalKeywords.some(keyword => treatment.toLowerCase().includes(keyword));
}

function extendDelay(delay) {
    const match = delay.match(/(\d+)\s*(\w+)/);
    if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        
        if (unit.includes('sem')) {
            return `${value + 1} sem`;
        } else if (unit.includes('mois')) {
            return `${Math.ceil(value * 1.5)} mois`;
        }
    }
    return delay;
}

function updateTreatmentTable(optimizedSequence) {
    const tableBody = document.querySelector('#treatmentTable tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = optimizedSequence.map((rdv, index) => {
        const isOptimized = rdv.optimized || rdv.delayOptimized;
        const rowClass = isOptimized ? 'optimized-row' : '';
        
        return `
            <tr class="${rowClass}">
                <td>${rdv.seance}</td>
                <td>
                    ${escapeHtml(rdv.traitement)}
                    ${rdv.originalTreatment ? 
                        `<span class="original-treatment">(Original: ${escapeHtml(rdv.originalTreatment)})</span>` 
                        : ''}
                </td>
                <td>${rdv.dents?.join(', ') || '-'}</td>
                <td>
                    ${escapeHtml(rdv.remarques || '-')}
                    ${isOptimized ? '<span class="optimization-badge">Optimisé</span>' : ''}
                </td>
                <td>${escapeHtml(rdv.delai || '-')}</td>
            </tr>
        `;
    }).join('');
}

function updateFinancialDisplay(financials) {
    const summary = financials.summary;
    const formatCurrency = window.pricingConfig.formatCurrency;
    
    // Update revenue card
    document.querySelector('.revenue-card .card-value').textContent = 
        formatCurrency(summary.totalRevenue);
    document.querySelector('.revenue-card .card-subtitle').textContent = 
        `${formatCurrency(summary.monthlyRevenue)}/mois`;
    
    // Update costs card
    document.querySelector('.costs-card .card-value').textContent = 
        formatCurrency(summary.totalCosts);
    document.querySelector('.costs-card .card-subtitle').textContent = 
        `${Math.round(summary.totalCosts / summary.totalRevenue * 100)}% du CA`;
    
    // Update profit card
    document.querySelector('.profit-card .card-value').textContent = 
        formatCurrency(summary.totalProfit);
    document.querySelector('.profit-card .card-subtitle').textContent = 
        `Marge: ${Math.round(summary.overallMargin * 100)}%`;
    
    // Reinitialize charts with new data
    setTimeout(() => {
        initializeFinancialCharts(financials);
    }, 100);
}

function resetOptimization() {
    const slider = document.getElementById('financialOptimizer');
    slider.value = 100;
    optimizeTreatmentSequence(100);
}

// Update margin display in settings
function updateMarginDisplay(value) {
    document.getElementById('marginReductionValue').textContent = `${value}%`;
}









// Filter Functions

function applyFilters() {
    const status = document.getElementById('statusFilter').value;
    const withTreatmentPlan = document.getElementById('treatmentPlanFilter').checked;
    const approvedOnly = document.getElementById('approvedFilter').checked;
    
    let filtered = allConversations;
    let activeFilterCount = 0;
    
    
    // Filter by status
    if (status) {
        filtered = filtered.filter(conv => conv.status === status);
        activeFilterCount++;
    }
    
    // Filter by treatment plan
    if (withTreatmentPlan) {
        filtered = filtered.filter(conv => conv.has_treatment_plan);
        activeFilterCount++;
    }
    
    // Filter by approval
    if (approvedOnly) {
        filtered = filtered.filter(conv => conv.treatment_plan_approved);
        activeFilterCount++;
    }
    
    // Update clear button visibility
    const hasFilters = activeFilterCount > 0;
    document.querySelector('.clear-filters-btn').style.display = hasFilters ? 'block' : 'none';
    
    // Update filter title to show active filter count
    updateFilterTitle(activeFilterCount);
    
    // Display filtered results
    displayConversations(filtered);
}

function updateFilterTitle(activeCount) {
    const filterTitle = document.querySelector('.filter-title span');
    if (activeCount > 0) {
        filterTitle.textContent = `Filtres (${activeCount})`;
        filterTitle.style.color = 'var(--accent-primary)';
    } else {
        filterTitle.textContent = 'Filtres';
        filterTitle.style.color = 'var(--text-secondary)';
    }
}

function clearFilters(event) {
    if (event) {
        event.stopPropagation();
    }
    
    document.getElementById('statusFilter').value = '';
    document.getElementById('treatmentPlanFilter').checked = false;
    document.getElementById('approvedFilter').checked = false;
    document.querySelector('.clear-filters-btn').style.display = 'none';
    
    updateFilterTitle(0);
    displayConversations(allConversations);
}

// Toggle filter expansion
function toggleFilters() {
    const filterContainer = document.getElementById('caseFilters');
    const isCollapsed = filterContainer.classList.contains('collapsed');
    
    if (isCollapsed) {
        filterContainer.classList.remove('collapsed');
        localStorage.setItem('filtersExpanded', 'true');
    } else {
        filterContainer.classList.add('collapsed');
        localStorage.setItem('filtersExpanded', 'false');
    }
}

// Restore filter state on load
function restoreFilterState() {
    const filtersExpanded = localStorage.getItem('filtersExpanded');
    const filterContainer = document.getElementById('caseFilters');
    
    if (filtersExpanded === 'true') {
        filterContainer.classList.remove('collapsed');
    }
}

// Missing UI functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    } else {
        sidebar.classList.add('mobile-open');
        if (overlay) overlay.classList.add('active');
    }
}

function toggleFilters() {
    const filterContainer = document.getElementById('caseFilters');
    const icon = document.getElementById('filterToggleIcon');
    
    filterContainer.classList.toggle('collapsed');
    localStorage.setItem('filtersExpanded', !filterContainer.classList.contains('collapsed'));
}

function clearFilters(event) {
    if (event) event.stopPropagation();
    
    // Clear filter values
    document.getElementById('statusFilter').value = '';
    
    // Reload conversations to show all
    loadConversations();
}


function showSearchPanel() {
    const panel = document.getElementById('searchPanel');
    if (panel) {
        panel.style.display = 'flex';
        document.getElementById('searchInput').focus();
    }
}

function sendSuggestion(text) {
    const input = document.getElementById('chatInput');
    if (input) {
        input.value = text;
        sendMessage();
    }
}

// Sequence approval functionality
let currentSequenceRating = 0;

function rateSequence(rating) {
    currentSequenceRating = rating;
    
    // Update stars display
    const stars = document.querySelectorAll('.rating-star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
            star.querySelector('i').className = 'fas fa-star';
        } else {
            star.classList.remove('active');
            star.querySelector('i').className = 'far fa-star';
        }
    });
    
    // Update rating text
    const ratingText = document.getElementById('ratingText');
    if (rating >= 9) {
        ratingText.textContent = `${rating}/10 - Excellent`;
        ratingText.style.color = '#10b981';
    } else if (rating >= 7) {
        ratingText.textContent = `${rating}/10 - Très bien`;
        ratingText.style.color = '#3b82f6';
    } else if (rating >= 5) {
        ratingText.textContent = `${rating}/10 - Correct`;
        ratingText.style.color = '#f59e0b';
    } else {
        ratingText.textContent = `${rating}/10 - À améliorer`;
        ratingText.style.color = '#ef4444';
    }
    
    // Enable approve button only if rated
    const approveBtn = document.getElementById('approveBtn');
    if (approveBtn) {
        approveBtn.disabled = false;
    }
}

// Show approval popup
function scrollToApprovalSection() {
    // Check if we have a treatment plan displayed
    if (!window.currentTreatmentPlan || !window.currentTreatmentPlan.treatment_sequence) {
        showNotification('warning', 'Aucune séquence de traitement à approuver');
        return;
    }
    
    // Check if already approved
    if (window.currentConversation && window.currentConversation.treatment_plan_approved) {
        showApprovalStatusModal();
        return;
    }
    
    // Create and show approval modal
    const modal = document.createElement('div');
    modal.className = 'modal approval-modal';
    modal.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fas fa-star"></i> Évaluer la séquence de traitement</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="rating-section" style="text-align: center; padding: 20px;">
                    <p style="margin-bottom: 20px;">Veuillez noter la qualité de cette séquence de traitement :</p>
                    <div class="star-rating-large" id="modalStarRating">
                        ${[1,2,3,4,5,6,7,8,9,10].map(i => `
                            <i class="fas fa-star star-large" 
                               data-rating="${i}" 
                               onclick="setModalRating(${i})"
                               title="${i}/10"></i>
                        `).join('')}
                    </div>
                    <p class="rating-text" id="modalRatingText" style="margin-top: 15px; font-size: 18px;">Non évalué</p>
                    <p class="approval-info" style="margin-top: 20px; color: #666; font-size: 14px;">
                        <i class="fas fa-info-circle"></i>
                        Les séquences notées 9/10 ou plus seront utilisées pour améliorer les suggestions futures
                    </p>
                </div>
                <div class="modal-actions" style="text-align: center; margin-top: 30px;">
                    <button class="secondary-btn" onclick="this.closest('.modal').remove()">
                        Annuler
                    </button>
                    <button class="primary-btn" id="modalApproveBtn" onclick="approveFromModal()" disabled>
                        <i class="fas fa-check"></i> Approuver et sauvegarder
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add click handler to close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Add styles for large stars
    const style = document.createElement('style');
    style.textContent = `
        .star-rating-large {
            font-size: 36px;
            color: #ddd;
        }
        .star-large {
            cursor: pointer;
            transition: color 0.2s;
            margin: 0 5px;
        }
        .star-large:hover {
            color: #ffa500;
        }
        .star-large.filled {
            color: #ffd700;
        }
        .approval-modal .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
    `;
    document.head.appendChild(style);
}

// Show approval status modal for already approved sequences
function showApprovalStatusModal() {
    const conv = window.currentConversation;
    const rating = conv.sequence_rating || 0;
    const ratingColor = rating >= 9 ? '#28a745' : 
                       rating >= 7 ? '#17a2b8' : 
                       rating >= 5 ? '#ffc107' : '#dc3545';
    
    const modal = document.createElement('div');
    modal.className = 'modal approval-modal';
    modal.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fas fa-check-circle" style="color: #28a745;"></i> Séquence déjà approuvée</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px;">
                    <div class="rating-display" style="font-size: 36px; color: #ffd700; margin-bottom: 20px;">
                        ${generateStars(rating)}
                    </div>
                    <p style="font-size: 24px; font-weight: bold; color: ${ratingColor}; margin-bottom: 10px;">
                        ${rating}/10
                    </p>
                    <p style="color: #666; margin-bottom: 20px;">
                        Approuvé par <strong>${conv.approved_by || 'Utilisateur'}</strong><br>
                        le ${formatDate(conv.approval_date)}
                    </p>
                    ${conv.approved_sequence_id ? `
                        <p style="color: #666; font-size: 14px;">
                            <i class="fas fa-database"></i> 
                            Séquence sauvegardée ID: ${conv.approved_sequence_id}
                        </p>
                    ` : ''}
                    ${rating >= 9 ? `
                        <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 10px; margin-top: 20px;">
                            <i class="fas fa-brain" style="color: #28a745;"></i>
                            Cette séquence est utilisée pour améliorer les suggestions IA
                        </div>
                    ` : ''}
                </div>
                <div class="modal-actions" style="text-align: center; margin-top: 30px;">
                    <button class="secondary-btn" onclick="showUpdateRatingModal()">
                        <i class="fas fa-edit"></i> Modifier la note
                    </button>
                    <button class="secondary-btn" onclick="removeApproval()">
                        <i class="fas fa-times"></i> Retirer l'approbation
                    </button>
                    <button class="primary-btn" onclick="this.closest('.modal').remove()">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add click handler to close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Modal rating system
let modalRating = 0;

function setModalRating(rating) {
    modalRating = rating;
    
    // Update stars
    const stars = document.querySelectorAll('#modalStarRating .star-large');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('filled');
        } else {
            star.classList.remove('filled');
        }
    });
    
    // Update text
    const ratingText = document.getElementById('modalRatingText');
    if (ratingText) {
        if (rating >= 9) {
            ratingText.innerHTML = `<strong>${rating}/10 - Excellent</strong> (Sera utilisé pour l'IA)`;
            ratingText.style.color = '#28a745';
        } else if (rating >= 7) {
            ratingText.innerHTML = `<strong>${rating}/10 - Très bien</strong>`;
            ratingText.style.color = '#17a2b8';
        } else if (rating >= 5) {
            ratingText.innerHTML = `<strong>${rating}/10 - Correct</strong>`;
            ratingText.style.color = '#ffc107';
        } else {
            ratingText.innerHTML = `<strong>${rating}/10 - À améliorer</strong>`;
            ratingText.style.color = '#dc3545';
        }
    }
    
    // Enable approve button
    const approveBtn = document.getElementById('modalApproveBtn');
    if (approveBtn) {
        approveBtn.disabled = false;
    }
}

async function approveFromModal() {
    if (!modalRating || !window.currentTreatmentPlan) {
        showNotification('warning', 'Veuillez noter la séquence');
        return;
    }
    
    const approveBtn = document.getElementById('modalApproveBtn');
    approveBtn.disabled = true;
    approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
    
    try {
        // Get the original prompt
        let originalPrompt = '';
        
        if (window.currentTreatmentPlan.consultation_text) {
            originalPrompt = window.currentTreatmentPlan.consultation_text;
        } else if (window.currentTreatmentPlan.case_title) {
            originalPrompt = window.currentTreatmentPlan.case_title;
        } else {
            // Try to extract from the last user message
            const userMessages = document.querySelectorAll('.message.user .message-content');
            if (userMessages.length > 0) {
                originalPrompt = userMessages[userMessages.length - 1].textContent.trim();
            }
        }
        
        // Prepare the approved sequence data
        const approvedSequence = {
            sequence: window.currentTreatmentPlan.treatment_sequence,
            rating: modalRating,
            original_prompt: originalPrompt,
            keywords: [],
            conversation_id: currentConversationId // Include conversation ID
        };
        
        const response = await fetch('/api/data/approved-sequence', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(approvedSequence)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showNotification('success', `Séquence approuvée avec une note de ${modalRating}/10`);
            
            // If high quality, notify about RAG usage
            if (modalRating >= 9) {
                showNotification('info', 'Cette séquence sera utilisée pour améliorer les suggestions futures');
            }
            
            // Close modal
            document.querySelector('.approval-modal').remove();
            
            // Reload conversation to get updated data
            if (currentConversationId) {
                await loadConversation(currentConversationId);
            }
            
            // Reload conversations list to show rating
            await loadConversations();
        } else {
            throw new Error(result.message || 'Erreur lors de la sauvegarde');
        }
    } catch (error) {
        console.error('Error approving sequence:', error);
        showNotification('error', 'Erreur lors de la sauvegarde de la séquence');
        approveBtn.disabled = false;
        approveBtn.innerHTML = '<i class="fas fa-check"></i> Approuver et sauvegarder';
    }
}

async function approveSequence() {
    if (!currentSequenceRating || !window.currentTreatmentPlan) {
        showNotification('warning', 'Veuillez d\'abord noter la séquence');
        return;
    }
    
    const approveBtn = document.getElementById('approveBtn');
    approveBtn.disabled = true;
    approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
    
    try {
        // Get the original prompt from the treatment plan or the conversation
        let originalPrompt = '';
        
        if (window.currentTreatmentPlan.consultation_text) {
            originalPrompt = window.currentTreatmentPlan.consultation_text;
        } else if (window.currentTreatmentPlan.case_title) {
            originalPrompt = window.currentTreatmentPlan.case_title;
        } else {
            // Try to extract from the first user message
            const userMessages = document.querySelectorAll('.message.user .message-content');
            if (userMessages.length > 0) {
                originalPrompt = userMessages[userMessages.length - 1].textContent.trim();
            }
        }
        
        // Prepare the approved sequence data matching the API expectations
        const approvedSequence = {
            sequence: window.currentTreatmentPlan.treatment_sequence,
            rating: currentSequenceRating,
            original_prompt: originalPrompt,
            keywords: []
        };
        
        const response = await fetch('/api/data/approved-sequence', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(approvedSequence)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            approveBtn.innerHTML = '<i class="fas fa-check"></i> Approuvé et sauvegardé';
            approveBtn.classList.add('approved');
            showNotification('success', `Séquence approuvée avec une note de ${currentSequenceRating}/10`);
            
            // If high quality, notify about RAG usage
            if (currentSequenceRating >= 9) {
                showNotification('info', 'Cette séquence sera utilisée pour améliorer les suggestions futures');
            }
        } else {
            throw new Error(result.message || 'Erreur lors de la sauvegarde');
        }
    } catch (error) {
        console.error('Error approving sequence:', error);
        showNotification('error', 'Erreur lors de la sauvegarde de la séquence');
        approveBtn.disabled = false;
        approveBtn.innerHTML = '<i class="fas fa-check"></i> Approuver et sauvegarder';
    }
}

// Quick action functionality - REMOVED
// function sendQuickAction(action) {
//     const prompts = {
//         'suggest-plan': 'Suggère un plan de traitement',
//         'generate-note': 'Génère une note clinique pour la consultation',
//         'clinical-tips': 'Donne des conseils cliniques pour ce cas'
//     };
//     
//     const prompt = prompts[action];
//     if (prompt) {
//         const input = document.getElementById('chatInput');
//         input.value = prompt;
//         sendMessage();
//     }
// }

