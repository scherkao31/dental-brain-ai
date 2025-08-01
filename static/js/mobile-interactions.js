// Mobile Interactions for Dental Brain AI

// Mobile Detection
function isMobile() {
    return window.innerWidth < 768;
}

function isTablet() {
    return window.innerWidth >= 768 && window.innerWidth <= 1024;
}

// Sidebar Toggle
function toggleSidebar() {
    console.log('toggleSidebar called');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (!sidebar) {
        console.error('Sidebar element not found');
        return;
    }
    
    if (sidebar.classList.contains('mobile-open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

// Make sure toggleSidebar is globally accessible
window.toggleSidebar = toggleSidebar;

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.add('mobile-open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
    document.body.style.overflow = ''; // Restore scroll
}

// Mobile-specific conversation selection
const originalLoadConversation = window.loadConversation;
window.loadConversation = async function(conversationId) {
    // Call original function
    await originalLoadConversation(conversationId);
    
    // Close sidebar on mobile after selection
    if (isMobile()) {
        closeSidebar();
    }
};

// Mobile-specific new chat
const originalStartNewChat = window.startNewChat;
window.startNewChat = async function() {
    // Call original function
    await originalStartNewChat();
    
    // Close sidebar on mobile
    if (isMobile()) {
        closeSidebar();
    }
};

// Touch gesture support for sidebar
let touchStartX = null;
let touchEndX = null;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!touchStartX) return;
    
    touchEndX = e.touches[0].clientX;
    
    // Swipe from left edge to open sidebar
    if (touchStartX < 20 && touchEndX > touchStartX + 50) {
        openSidebar();
    }
    
    // Swipe left to close sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('mobile-open') && touchStartX > touchEndX + 50) {
        closeSidebar();
    }
}, { passive: true });

document.addEventListener('touchend', () => {
    touchStartX = null;
    touchEndX = null;
}, { passive: true });

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    // Recalculate layout after orientation change
    setTimeout(() => {
        if (!isMobile() && !isTablet()) {
            // Ensure sidebar is visible on desktop
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.remove('mobile-open');
            document.querySelector('.sidebar-overlay').classList.remove('active');
        }
    }, 100);
});

// Handle resize events
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (!isMobile() && !isTablet()) {
            // Ensure proper desktop layout
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.remove('mobile-open');
            document.querySelector('.sidebar-overlay').classList.remove('active');
            document.body.style.overflow = '';
        }
    }, 250);
});

// Mobile keyboard handling
if (isMobile()) {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        // Scroll to input when focused
        chatInput.addEventListener('focus', () => {
            setTimeout(() => {
                chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    }
}

// Initialize mobile-specific features on load
document.addEventListener('DOMContentLoaded', () => {
    // Ensure sidebar is closed on mobile load
    if (isMobile()) {
        closeSidebar();
    }
    
    // Add mobile class to body for additional styling hooks
    if (isMobile()) {
        document.body.classList.add('mobile');
    } else if (isTablet()) {
        document.body.classList.add('tablet');
    }
});

// Pull to refresh for mobile
let pullStartY = null;
let isPulling = false;

if (isMobile()) {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.addEventListener('touchstart', (e) => {
            if (chatMessages.scrollTop === 0) {
                pullStartY = e.touches[0].clientY;
            }
        }, { passive: true });
        
        chatMessages.addEventListener('touchmove', (e) => {
            if (pullStartY !== null && chatMessages.scrollTop === 0) {
                const pullDistance = e.touches[0].clientY - pullStartY;
                if (pullDistance > 50 && !isPulling) {
                    isPulling = true;
                    // Add pull-to-refresh indicator
                    const indicator = document.createElement('div');
                    indicator.className = 'pull-refresh-indicator';
                    indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
                    chatMessages.insertBefore(indicator, chatMessages.firstChild);
                }
            }
        }, { passive: true });
        
        chatMessages.addEventListener('touchend', async () => {
            if (isPulling) {
                // Refresh conversations
                if (window.loadConversations) {
                    await window.loadConversations();
                }
                
                // Remove indicator
                const indicator = document.querySelector('.pull-refresh-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
            pullStartY = null;
            isPulling = false;
        }, { passive: true });
    }
}

// Smooth scroll for mobile
if (isMobile() || isTablet()) {
    document.querySelectorAll('.chat-messages').forEach(element => {
        element.style.scrollBehavior = 'smooth';
        element.style.webkitOverflowScrolling = 'touch';
    });
}