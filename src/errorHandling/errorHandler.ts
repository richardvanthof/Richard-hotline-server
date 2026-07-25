import { Response, NextFunction } from 'express';
import { MulterError } from 'multer';

type ErrorEntry = { status: number; message: string };

const errors: Record<string, ErrorEntry> = {
    USER_NOT_FOUND:                { status: 404, message: 'User not found' },
    INVALID_PASSWORD:               { status: 401, message: 'Invalid password' },
    INVALID_CREDENTIALS:            { status: 401, message: 'Invalid username or password' },
    REFRESH_TOKEN_NOT_FOUND:        { status: 401, message: 'Refresh token not found' },
    REFRESH_TOKEN_SECRET_UNDEFINED: { status: 500, message: 'Refresh token secret is undefined' },
    ACCESS_TOKEN_SECRET_UNDEFINED:  { status: 500, message: 'Access token secret is undefined' },
    SESSION_EXPIRED:                { status: 403, message: 'Session expired' },
    USER_ID_UNDEFINED:              { status: 500, message: 'User ID is undefined' },
    INVALID_OR_EXPIRED_TOKEN:       { status: 403, message: 'Invalid or expired token' },
    INTERNAL_ERROR:                 { status: 500, message: 'Internal server error' },
    DUPLICATE_EMAIL:                { status: 409, message: 'Email already in use' },
    DUPLICATE_USERNAME:             { status: 409, message: 'Username already in use' },
    NOT_AUTHORIZED:                 { status: 403, message: 'Not authorized to perform this action' },
    LOGGED_OUT:                     { status: 200, message: 'Logged out successfully' },
    LOGGED_OUT_ALL:                 { status: 200, message: 'Logged out from all sessions successfully' },
    RESET_PASSWORD_EMAIL_SENT:      { status: 200, message: 'Password reset email sent successfully' },
    PSSWD_EMAIL_SERVICE_ERROR:      { status: 500, message: 'Error sending password reset email' },
    EMAIL_UNDEFINED:                { status: 400, message: 'Email is undefined' },
    ONLY_IMAGES_ALLOWED:            { status: 400, message: 'Only image uploads are allowed' },
    PASSWORD_RESET_SUCCESSFUL:      { status: 200, message: 'Password reset successfully' },
    FILES_UNDEFINED:                { status: 400, message: 'Files are undefined' },
};

// Sends the response AND returns, so callers can't forget either half
function sendError(res: Response, code: keyof typeof errors): void {
    const entry = errors[code] ?? errors.INTERNAL_ERROR;
    res.status(entry.status).send({ error: code, message: entry.message });
}

export function handleUploadError(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof MulterError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      errors: [{ path: ['images'], message: multerMessages[err.code] ?? err.message }],
    });
    return;
  }

  if (err instanceof Error) {
    // covers the fileFilter's ONLY_IMAGES_ALLOWED throw
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      errors: [{ path: ['images'], message: err.message }],
    });
    return;
  }

  next(err);
}

const multerMessages: Record<string, string> = {
  LIMIT_FILE_SIZE: 'Each image must be under 500KB.',
  LIMIT_FILE_COUNT: 'You can upload a maximum of 3 images.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
};

export default sendError;