/**
 * Security-Safe Error Normalization (`src/utils/errors.ts`)
 *
 * Maps Firebase Auth, Cloud Firestore, and Firebase Storage errors to clean,
 * user-friendly messages without exposing raw stack traces, internal rule paths,
 * or sensitive schema hints.
 */

export class AppSecurityError extends Error {
  public readonly code: string;
  public readonly isPermissionError: boolean;

  constructor(code: string, userMessage: string, isPermissionError = false) {
    super(userMessage);
    this.name = 'AppSecurityError';
    this.code = code;
    this.isPermissionError = isPermissionError;
  }
}

const FIREBASE_ERROR_MAP: Record<string, { message: string; isPermission?: boolean }> = {
  // Firestore & RBAC
  'permission-denied': {
    message: 'Access denied. You do not have permission to perform this action.',
    isPermission: true,
  },
  'unauthenticated': {
    message: 'Your security session has expired. Please sign in again.',
    isPermission: true,
  },
  'failed-precondition': {
    message: 'This action cannot be completed in the current state.',
  },
  'invalid-argument': {
    message: 'Some submitted fields failed server validation. Check your inputs.',
  },
  'not-found': {
    message: 'The requested record could not be found.',
  },
  'unavailable': {
    message: 'Service temporarily unavailable. Please try again in a moment.',
  },
  'resource-exhausted': {
    message: 'Rate limit exceeded. Please wait briefly before retrying.',
  },

  // Firebase Storage
  'storage/unauthorized': {
    message: 'Upload rejected: missing permissions, file exceeds 5 MB, or unsupported format (JPEG/PNG only).',
    isPermission: true,
  },
  'storage/canceled': {
    message: 'Media upload was canceled.',
  },
  'storage/quota-exceeded': {
    message: 'Storage quota exceeded. Please contact municipal IT support.',
  },
  'storage/invalid-argument': {
    message: 'Invalid image file selected. Only JPEG and PNG images up to 5 MB are supported.',
  },

  // Firebase Auth (Unified non-enumerating messages)
  'auth/invalid-credential': {
    message: 'Invalid email or password. Please verify your credentials.',
  },
  'auth/wrong-password': {
    message: 'Invalid email or password. Please verify your credentials.',
  },
  'auth/user-not-found': {
    message: 'Invalid email or password. Please verify your credentials.',
  },
  'auth/email-already-in-use': {
    message: 'An account with this email already exists.',
  },
  'auth/weak-password': {
    message: 'Password is too weak. Use at least 6 characters.',
  },
  'auth/invalid-email': {
    message: 'Please enter a valid email address.',
  },
  'auth/too-many-requests': {
    message: 'Too many authentication attempts. Please wait before trying again.',
    isPermission: true,
  },
  'auth/user-disabled': {
    message: 'This account has been suspended by an administrator.',
    isPermission: true,
  },
  'auth/network-request-failed': {
    message: 'Network connection error. Please check your internet connection.',
  },
  'auth/requires-recent-login': {
    message: 'For security, please sign out and sign back in before deleting your account.',
    isPermission: true,
  },
};

/**
 * Extracts a normalized Firebase error code (with or without service prefix).
 */
function extractErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as any).code === 'string') {
    const rawCode = (error as any).code as string;
    // Firebase Firestore sometimes emits "firestore/permission-denied" or just "permission-denied"
    if (rawCode.startsWith('firestore/')) {
      return rawCode.replace('firestore/', '');
    }
    return rawCode;
  }
  return 'unknown';
}

/**
 * Converts any caught error into a safe AppSecurityError for UI presentation.
 */
export function normalizeSecurityError(
  error: unknown,
  fallbackMessage = 'Unable to complete request. Please try again.'
): AppSecurityError {
  if (error instanceof AppSecurityError) {
    return error;
  }

  const code = extractErrorCode(error);
  const mapped = FIREBASE_ERROR_MAP[code];

  if (__DEV__) {
    // Log strictly the symbolic error code during development — never emit raw tokens/credentials
    console.warn(`[SecurityHandler] Normalized error code="${code}"`);
  }

  if (mapped) {
    return new AppSecurityError(code, mapped.message, Boolean(mapped.isPermission));
  }

  // Custom validation errors explicitly thrown by client validation helpers
  if (
    error instanceof Error &&
    (error.name === 'ValidationError' || error.name === 'SecurityValidationError')
  ) {
    return new AppSecurityError('validation-error', error.message, false);
  }

  return new AppSecurityError(code, fallbackMessage, code.includes('permission') || code.includes('unauthorized'));
}

export function getSafeErrorMessage(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred.'
): string {
  return normalizeSecurityError(error, fallbackMessage).message;
}
