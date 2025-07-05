// Error handling utilities

// Sanitize error messages to remove sensitive information
export function sanitizeErrorMessage(error: Error | unknown): {
  message: string;
  type: string;
  details?: string;
} {
  if (error instanceof Error) {
    const errorName = error.name || 'Error';
    let message = error.message || 'An unexpected error occurred';
    let details: string | undefined;

    // Remove sensitive patterns
    message = message
      // Remove URLs with credentials
      .replace(/https?:\/\/[^:]+:[^@]+@[^\s]+/g, '[REDACTED_URL]')
      // Remove auth tokens
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]')
      // Remove API keys
      .replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED_KEY]')
      // Remove database URLs
      .replace(/libsql:\/\/[^\s]+/g, '[DATABASE_URL]')
      // Remove email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

    // Categorize common errors with helpful messages
    let type: string;
    if (message.includes('Failed query') || message.includes('Database')) {
      type = 'Database Error';
      details = 'There was a problem accessing the database. This is usually temporary.';
    } else if (message.includes('Network') || message.includes('fetch')) {
      type = 'Network Error';
      details = 'Unable to connect to required services. Please check your connection.';
    } else if (message.includes('Authentication') || message.includes('Unauthorized')) {
      type = 'Authentication Error';
      details = 'Your session may have expired. Please try signing in again.';
    } else if (message.includes('Permission') || message.includes('Forbidden')) {
      type = 'Permission Error';
      details = 'You do not have permission to access this resource.';
    } else if (message.includes('Not Found') || message.includes('404')) {
      type = 'Not Found';
      details = 'The requested resource could not be found.';
    } else if (message.includes('Validation') || message.includes('Invalid')) {
      type = 'Validation Error';
      details = 'The provided data is invalid. Please check your input.';
    } else if (message.includes('Rate limit')) {
      type = 'Rate Limit Error';
      details = 'Too many requests. Please wait a moment before trying again.';
    } else {
      type = errorName;
    }

    return {
      message: message.substring(0, 200), // Limit message length
      type,
      details
    };
  }

  // Handle non-Error objects
  return {
    message: 'An unexpected error occurred',
    type: 'Unknown Error'
  };
}

// Generate a unique error ID for tracking
export function generateErrorId(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

// Determine appropriate HTTP status code from error
export function getErrorStatusCode(error: Error | unknown): number {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('not found') || message.includes('404')) return 404;
    if (message.includes('unauthorized') || message.includes('authentication')) return 401;
    if (message.includes('forbidden') || message.includes('permission')) return 403;
    if (message.includes('validation') || message.includes('invalid')) return 400;
    if (message.includes('rate limit')) return 429;
    if (message.includes('timeout')) return 408;
  }
  
  return 500;
}