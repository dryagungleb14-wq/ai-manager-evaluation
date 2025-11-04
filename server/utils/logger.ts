/**
 * Structured logging utility for better error diagnostics
 * Provides consistent logging format across the application
 */

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
    const logData = metadata
      ? { message, ...metadata, timestamp: new Date().toISOString() }
      : message;
    console.warn(`[${context}] ${message}`, metadata ? logData : '');
  },

  /**
   * Log an informational message
   * @param context - The context/module
   * @param message - Info message
   * @param metadata - Additional metadata
   */
  info: (context: string, message: string, metadata?: Record<string, any>) => {
    const logData = metadata
      ? { message, ...metadata, timestamp: new Date().toISOString() }
      : undefined;
    console.log(`[${context}] ${message}`, logData || '');
  },

  /**
   * Log database connection errors with sensitive data masked
   * @param error - Database error
   * @param databaseUrl - Database URL (password will be masked)
   */
  dbConnectionError: (error: unknown, databaseUrl?: string) => {
    const maskedUrl = databaseUrl?.replace(/:[^:@]+@/, ':***@');
    
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
