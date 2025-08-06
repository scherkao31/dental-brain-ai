# Frontend Modularization Migration Guide

## Overview

The frontend has been refactored from a monolithic 3000+ line `chat-app.js` file into a clean, modular ES6 architecture. This guide helps you understand the new structure and migrate any custom code.

## New Module Structure

```
static/js/
├── app.js                    # Main entry point
└── modules/
    ├── state.js              # Centralized state management
    ├── api-client.js         # All API calls
    ├── conversations.js      # Conversation management
    ├── messages.js           # Chat message handling
    ├── patient-selector.js   # Patient selection UI
    ├── filters.js            # Conversation filtering
    ├── notifications.js      # Toast notifications
    ├── dom-utils.js          # DOM manipulation helpers
    ├── modals.js             # Modal dialogs
    ├── loading.js            # Loading states & errors
    └── validation.js         # Input validation & security
```

## Key Changes

### 1. State Management

**Old:**
```javascript
// Global variables scattered throughout
let currentConversationId = null;
let currentPatientId = null;
let isLoading = false;
```

**New:**
```javascript
import { appState } from './modules/state.js';

// Get state
const patientId = appState.currentPatientId;

// Set state
appState.setState({ currentPatientId: 123 });

// Subscribe to changes
appState.subscribe((property) => {
    if (property === 'currentPatientId') {
        console.log('Patient changed:', appState.currentPatientId);
    }
});
```

### 2. API Calls

**Old:**
```javascript
// Inline fetch calls
fetch('/api/patients', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
})
.then(response => response.json())
.then(data => {
    // Handle response
});
```

**New:**
```javascript
import { apiClient } from './modules/api-client.js';

// All API calls are centralized
const result = await apiClient.getPatients();
if (result.status === 'success') {
    // Handle data
}
```

### 3. Notifications

**Old:**
```javascript
// Custom notification code
function showNotification(type, message) {
    // Complex DOM manipulation
}
```

**New:**
```javascript
import { notifications } from './modules/notifications.js';

notifications.success('Operation successful!');
notifications.error('Something went wrong');
notifications.warning('Please check your input');
notifications.info('New update available');
```

### 4. DOM Utilities

**Old:**
```javascript
// Scattered DOM manipulation
document.getElementById('myElement').style.display = 'none';
const div = document.createElement('div');
div.className = 'my-class';
div.innerHTML = userInput; // XSS risk!
```

**New:**
```javascript
import { DOMUtils } from './modules/dom-utils.js';

// Safe and consistent DOM manipulation
DOMUtils.hide('myElement');
DOMUtils.show('myElement', 'flex');

const element = DOMUtils.createElement('div', {
    className: 'my-class',
    textContent: DOMUtils.escapeHtml(userInput), // XSS safe
    events: {
        click: () => console.log('Clicked!')
    }
});
```

### 5. Loading States

**Old:**
```javascript
// Manual loading indicators
button.disabled = true;
button.innerHTML = 'Loading...';
```

**New:**
```javascript
import { loadingManager } from './modules/loading.js';

// Consistent loading states
loadingManager.setButtonLoading(button, true);
loadingManager.showSkeletonLoader('conversationsList');
loadingManager.showError('container', error, () => retry());
```

### 6. Input Validation

**Old:**
```javascript
// Basic validation
if (!email || !email.includes('@')) {
    alert('Invalid email');
}
```

**New:**
```javascript
import { ValidationRules, FormValidator } from './modules/validation.js';

// Advanced validation
const validator = new FormValidator('myForm');
validator
    .required('email')
    .email('email')
    .minLength('password', 8);

if (validator.validate()) {
    // Form is valid
}

// Or individual validation
const result = ValidationRules.email(userEmail);
if (!result.valid) {
    console.error(result.error);
}
```

## Migration Steps

### 1. Update HTML

Replace in `chat.html`:
```html
<!-- Old -->
<script src="{{ url_for('static', filename='js/chat-app.js') }}"></script>

<!-- New -->
<script type="module" src="{{ url_for('static', filename='js/app.js') }}"></script>
```

### 2. Update Event Handlers

Global functions are still available for onclick handlers:
```html
<!-- These still work -->
<button onclick="startNewChat()">New Chat</button>
<button onclick="sendMessage()">Send</button>
```

### 3. Custom Code Migration

If you have custom JavaScript that extends the chat functionality:

1. Create a new module in `/static/js/modules/`
2. Import required dependencies
3. Export your functionality
4. Import it in `app.js`

Example custom module:
```javascript
// modules/custom-feature.js
import { apiClient } from './api-client.js';
import { appState } from './state.js';
import { notifications } from './notifications.js';

export class CustomFeature {
    async doSomething() {
        const result = await apiClient.request('/api/custom');
        if (result.status === 'success') {
            notifications.success('Custom action completed!');
        }
    }
}

export const customFeature = new CustomFeature();
```

### 4. Testing

1. Open the test page: `/static/test-modular.html`
2. Test each module's functionality
3. Check browser console for errors
4. Verify all features work as expected

## Benefits of New Architecture

1. **Maintainability**: Each module has a single responsibility
2. **Testability**: Modules can be tested in isolation
3. **Reusability**: Modules can be used across different pages
4. **Performance**: Only load what you need
5. **Security**: Built-in XSS protection and input validation
6. **Type Safety**: Better IDE support with ES6 modules

## Rollback Plan

If issues arise, you can temporarily rollback:

1. Comment out the new script tag
2. Uncomment the old chat-app.js script tag
3. Report the issue for fixing

## Common Issues

### Issue: "X is not defined"
**Solution**: The function might need to be made global. Check if it's exported to `window` in the module.

### Issue: Module not loading
**Solution**: Ensure you're using `type="module"` in the script tag and the server is serving correct MIME types.

### Issue: onclick handlers not working
**Solution**: Make sure the function is assigned to `window` object in the module.

## Need Help?

1. Check the module documentation in each file
2. Look at the test page for examples
3. Check browser console for detailed error messages
4. Review the app.js file for initialization logic