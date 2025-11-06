/**
 * Structured logging utility for better error diagnostics
 * Provides consistent logging format across the application
 */

/**
 * Mask password in database URL for secure logging
 * @param url - Database URL that may contain password
 * @returns URL with password replaced by ***
 */
export function maskPassword(url?: string): string | undefined {
  return url?.replace(/:[^:@]+@/, ':***@');
}

export const logger = {
  /**
   * Log an error with full context and stack trace
   * @param context - The context/module where the error occurred (e.g., 'storage', 'db', 'auth')
   * @param error - The error object or message
   * @param metadata - Additional metadata to include in the log
   */
  error: (context: string, error: unknown, metadata?: Record<string, any>) => {
    const timestamp = new Date().toISOString();
    const errorDetails: Record<string, any> = {
      timestamp,
      context,
    };

    if (error instanceof Error) {
      errorDetails.message = error.message;
      errorDetails.stack = error.stack;
      errorDetails.name = error.name;
      
      // Include additional error properties if they exist
      if ('code' in error) errorDetails.code = error.code;
      if ('detail' in error) errorDetails.detail = error.detail;
      if ('hint' in error) errorDetails.hint = error.hint;
      if ('cause' in error) errorDetails.cause = error.cause;
    } else if (typeof error === 'object' && error !== null) {
      // Handle plain error objects (e.g., from some database drivers)
      // Extract specific properties to avoid circular references
      if ('message' in error) errorDetails.message = String(error.message);
      if ('code' in error) errorDetails.code = error.code;
65
  if ('hint' in error) errorDetails.hint = error.hint;
      if ('stack' in error) errorDetails.stack = error.stack;
      if ('name' in error) errorDetails.name = error.name;
    } else {
      errorDetails.message = String(error);
    }

    if (metadata) {
      Object.assign(errorDetails, metadata);
    }

    console.error(`[${context}] Error:`, errorDetails);
  },

  /**
   * Log a warning message
   * @param context - The context/module
   * @param message - Warning message
   * @param metadata - Additional metadata
   */
  warn: (context: string, message: string, metadata?: Record<string, any>) => {
    if (metadata && Object.keys(metadata).length > 0) {
          const cleanMeta = metadata && Object.keys(metadata).length > 0 ? Object.fromEntries(Object.entries(metadata).filter(([, v]) => v != null)) : {};
      
      const logData = { message, ...cleanMeta, timestamp: new Date().toISOString() };
      console.warn(`[${context}] ${message}`, logData);
    } else {
      console.warn(`[${context}] ${message}`);
    }
  },

  /**
   * Log an informational message
   * @param context - The context/module
   * @param message - Info message
   * @param metadata - Additional metadata
   */
  info: (context: string, message: string, metadata?: Record<string, any>) => {
    if (metadata && Object.keys(metadata).length > 0) {
          const cleanMeta = metadata && Object.keys(metadata).length > 0 ? Object.fromEntries(Object.entries(metadata).filter(([, v]) => v != null)) : {};
      
      const logData = { message, ...cleanMeta, timestamp: new Date().toISOString() };
      console.log(`[${context}] ${message}`, logData);
    } else {
      console.log(`[${context}] ${message}`);
    }
  },

  /**
   * Log database connection errors with sensitive data masked
   * @param error - Database error
   * @param databaseUrl - Database URL (password will be masked)
   */
  dbConnectionError: (error: unknown, databaseUrl?: string) => {
    const maskedUrl = maskPassword(databaseUrl);
    
    const details: Record<string, any> = {
      timestamp: new Date().toISOString(),
    };

    if (error instanceof Error) {
      details.message = error.message;
      details.stack = error.stack;
      
      // PostgreSQL specific error fields
      if ('code' in error) details.code = error.code;
      if ('detail' in error) details.detail = error.detail;
      if ('hint' in error) details.hint = error.hint;
      if ('severity' in error) details.severity = error.severity;
      if ('position' in error) details.position = error.position;
    } else {
      details.message = String(error);
    }

    if (maskedUrl) {
      details.url = maskedUrl;
    }

    console.error('[db] PostgreSQL connection error:', details);
  },
};
