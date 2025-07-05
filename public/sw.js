// Service Worker for Admin Notifications
const CACHE_NAME = 'admin-notifications-v1';
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

// Store the last check time and seen items
let lastCheckTime = Date.now();
let seenItems = new Set();

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Background sync for checking new content
self.addEventListener('sync', event => {
  if (event.tag === 'check-admin-updates') {
    event.waitUntil(checkForNewContent());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'admin-updates') {
    event.waitUntil(checkForNewContent());
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/admin';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Check if there's already a window open with the admin panel
      for (const client of clients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

async function checkForNewContent() {
  try {
    // Get current timestamp for the check
    const currentTime = Date.now();
    const sinceParam = `?since=${lastCheckTime}`;
    
    // Check for new comments (general feedback) - authenticated request
    const commentsResponse = await fetch(`/api/admin/notifications/comments${sinceParam}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (commentsResponse.ok) {
      const comments = await commentsResponse.json();
      
      for (const comment of comments) {
        const commentKey = `comment-${comment.id}`;
        if (!seenItems.has(commentKey)) {
          seenItems.add(commentKey);
          await showNotification('New Feedback Received', {
            body: `New feedback from ${comment.userName || comment.userEmail || 'User'}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'admin-feedback',
            data: { url: '/admin/feedback', type: 'comment', id: comment.id }
          });
        }
      }
    } else if (commentsResponse.status === 401 || commentsResponse.status === 403) {
      // User is not authenticated as admin, stop checking
      console.log('Admin authentication required for notifications');
      return;
    }
    
    // Check for new church suggestions - authenticated request
    const suggestionsResponse = await fetch(`/api/admin/notifications/suggestions${sinceParam}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (suggestionsResponse.ok) {
      const suggestions = await suggestionsResponse.json();
      
      for (const suggestion of suggestions) {
        const suggestionKey = `suggestion-${suggestion.id}`;
        if (!seenItems.has(suggestionKey)) {
          seenItems.add(suggestionKey);
          await showNotification('New Church Submission', {
            body: `New church suggested: ${suggestion.churchName}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'admin-submission',
            data: { url: '/admin/submissions', type: 'suggestion', id: suggestion.id }
          });
        }
      }
    } else if (suggestionsResponse.status === 401 || suggestionsResponse.status === 403) {
      // User is not authenticated as admin, stop checking
      console.log('Admin authentication required for notifications');
      return;
    }
    
    // Update last check time
    lastCheckTime = currentTime;
    
    // Schedule next check
    setTimeout(() => {
      self.registration.sync.register('check-admin-updates').catch(() => {
        // Fallback if background sync isn't supported
        checkForNewContent();
      });
    }, CHECK_INTERVAL);
    
  } catch (error) {
    console.error('Error checking for admin updates:', error);
  }
}

async function showNotification(title, options) {
  if (self.registration.showNotification) {
    await self.registration.showNotification(title, options);
  }
}

// Initialize first check after service worker is ready
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'INIT_ADMIN_CHECKS') {
    checkForNewContent();
  }
});