import { Request, Response, Router } from 'express';
import query from '../db/db_connect';
import path from 'path';

// Authentication
import { createUser, login, generateToken, generateResetToken, resetPassword, getRefreshTokens } from '../authentication/authenticate';
import { authenticateToken } from '../authorization/authorization';

import sendMail from '../lib/send-mail';
import jwt from 'jsonwebtoken';

import {UserData} from '../authentication/authenticate';

const userRoutes = Router()

type ErrorEntry = { status: number; message: string };

const errors: Record<string, ErrorEntry> = {
    USER_NOT_FOUND:                 { status: 404, message: 'User not found' },
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
    RESET_PASSWORD_EMAIL_SENT:      { status: 200, message: 'Password reset email sent. Please check your inbox.' },
    PSSWD_EMAIL_SERVICE_ERROR:      { status: 500, message: 'Error sending password reset email' },
    EMAIL_UNDEFINED:                { status: 400, message: 'Email is undefined' },
    PASSWORD_RESET_SUCCESSFUL:      { status: 200, message: 'Password reset successfully' },
};

// Sends the response AND returns, so callers can't forget either half
function sendError(res: Response, code: keyof typeof errors): void {
    const entry = errors[code] ?? errors.INTERNAL_ERROR;
    res.status(entry.status).send({ error: code, message: entry.message });
}

const getAccessTokenExpirationTimestamp = (expiration?: string): number | undefined => {
    if (!expiration) {
        return undefined;
    }

    const match = expiration.trim().match(/^(\d+)(ms|s|m|h|d)?$/i);
    if (!match) {
        return undefined;
    }

    const amount = Number(match[1]);
    const unit = (match[2] ?? 's').toLowerCase();
    const multipliers: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    return Date.now() + amount * multipliers[unit];
};

// Type guard so you're not just casting `err as any`
function isDatabaseError(err: unknown): err is { code: string; detail?: string; constraint?: string } {
    return typeof err === 'object' && err !== null && 'code' in err;
}

// Optional: pull the field name out of the constraint or detail string
function extractField(err: { constraint?: string; detail?: string }): string {
    if (err.constraint === 'users_email_key') return 'Email';
    if (err.constraint === 'users_username_key') return 'Username';
    return 'Value';
}

// Validate the reset token
async function validateToken(token: string): Promise<boolean> {
    try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || '');
        return !!decoded;
    } catch (err) {
        return false;
    }
}

// ACCOUNT MANAGEMENT
userRoutes.post('/users', async (req: Request, res: Response):Promise<void> => {
    try {
        const userInfo: UserData = req.body;
        const resp = await createUser(userInfo);
        res.status(201).send(resp);
    } catch(err) {
        if (isDatabaseError(err) && err.code === '23505') {
            sendError(res, `DUPLICATE_${extractField(err).toUpperCase()}`);
            return;
        }

        console.error(err); // log the real error server-side
        sendError(res, 'INTERNAL_ERROR');
    }
    });

    userRoutes.get('/users', authenticateToken, async (req: Request, res: Response):Promise<void> => {
    res.send('success')
});

// Authenticate

userRoutes.post('/login', async (req: Request, res: Response):Promise<void> => {
    try {
        const {username, password} = req.body;
        const authenticated = await login(username, password);
        if(authenticated.success) {
            if(!process.env.ACCESS_TOKEN_SECRET) {
                sendError(res, 'ACCESS_TOKEN_SECRET_UNDEFINED');
                return;
            };
            if(!process.env.REFRESH_TOKEN_SECRET) {
                sendError(res, 'REFRESH_TOKEN_SECRET_UNDEFINED');       
                return;
            };
            const {id, username, role} = authenticated.user;
            if(id) {
                const refreshToken = await generateToken({id, username, role}, process.env.REFRESH_TOKEN_SECRET || '');
                let refreshTokens = await getRefreshTokens(id);
                refreshTokens.push(refreshToken);
                await query('UPDATE users SET refresh_tokens = $1, last_login = NOW() WHERE id = $2', [refreshTokens, id]);
                const accessToken = await generateToken({id, username, role}, process.env.ACCESS_TOKEN_SECRET || '', process.env.ACCESS_TOKEN_EXPIRATION);
                res.status(200).send({
                    success: true,
                    accessToken,
                    accessTokenExpiration: getAccessTokenExpirationTimestamp(process.env.ACCESS_TOKEN_EXPIRATION),
                    issuedAt: Date.now(),
                    refreshToken
                });
            } else {
                throw new Error('USER_ID_UNDEFINED');
            }
        } else {
            throw new Error('INVALID_CREDENTIALS');
        }
        
    } catch(err) {
        if (err instanceof Error) {
            if(
                err.message === 'USER_NOT_FOUND' || 
                err.message === 'INVALID_PASSWORD' ||
                err.message === 'INVALID_CREDENTIALS'
            ) {
                sendError(res, 'INVALID_CREDENTIALS');
            } else {
                sendError(res, 'INTERNAL_ERROR');
            }
        } else {
            console.error('Trouble signing in:', err);
            sendError(res, 'INTERNAL_ERROR');
        }

    }
});
  
userRoutes.post('/refresh', async (req: Request, res: Response):Promise<void> => {
try {
    const authHeaders = req.headers['authorization'] as string;
    const refreshToken:string = authHeaders && authHeaders.split(' ')[1];
    if(!refreshToken) {
        sendError(res, 'REFRESH_TOKEN_NOT_FOUND');
    } else if(!process.env.REFRESH_TOKEN_SECRET) {
        sendError(res, 'REFRESH_TOKEN_SECRET_UNDEFINED');
    } else {
        const data = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET) as jwt.JwtPayload;
        const {id, username, role} = data;
        const accessToken = await generateToken({id, username, role}, process.env.ACCESS_TOKEN_SECRET || '', process.env.ACCESS_TOKEN_EXPIRATION);
        res.status(200).send({
            success: true,
            accessToken,
            accessTokenExpiration: getAccessTokenExpirationTimestamp(process.env.ACCESS_TOKEN_EXPIRATION),
            issuedAt: Date.now(),
        });
    };
} catch(err) {
    if (err instanceof Error) {
    if(err.message === 'jwt expired' || err.message === 'invalid token') {
        sendError(res, 'INVALID_CREDENTIALS');
    } else {
        sendError(res, 'INTERNAL_ERROR');
    }
    }
}
}); 

userRoutes.delete('/logout', authenticateToken, async (req: Request, res: Response):Promise<void> => {
    try {
        const {id} = req.user;
        const {refreshToken} = req.body;
        if(id && refreshToken) {
            let refreshTokens = await getRefreshTokens(id);
            if(refreshTokens.some((token:string) => token === refreshToken)) {
                refreshTokens = refreshTokens.filter((token:string) => token !== refreshToken);
                await query('UPDATE users SET refresh_tokens = $1 WHERE id = $2', [refreshTokens, id]);
                sendError(res, 'LOGGED_OUT');
            } else {
                sendError(res, 'NOT_AUTHORIZED');
            }
        } else {
            sendError(res, 'USER_ID_UNDEFINED');
        }
    } catch(err) {
        if (err instanceof Error) {
            if (err.message === 'jwt expired' || err.message === 'invalid token') {
                sendError(res, 'SESSION_EXPIRED');
            } else {
                sendError(res, 'INTERNAL_ERROR');
            }
            return;
        }
        sendError(res, 'INTERNAL_ERROR');
    }
});

userRoutes.delete('/logout-all', authenticateToken, async (req: Request, res: Response):Promise<void> => {
    try {
        const {id} = req.user;
        
   
        if(id) {
            await query('UPDATE users SET refresh_tokens = $1 WHERE id = $2', [[], id]);
            sendError(res, 'LOGGED_OUT_ALL');
            return;
        } else {
            sendError(res, 'USER_ID_UNDEFINED');
            return;
        }
    } catch(err) {
        if (err instanceof Error) {
            sendError(res, 'INTERNAL_ERROR');
            return;
        }
        sendError(res, 'INTERNAL_ERROR');
    }
});

userRoutes.post('/forgot-password', async (req: Request, res: Response):Promise<void> => {
    try {
        const {email} = req.body;
        if(!email) { res.status(400).send(sendError(res, 'EMAIL_UNDEFINED')); return; }; 
        const resetToken = await generateResetToken(email);
     
        console.log({resetToken})
        const subject = 'Password Reset';
        const url = `http://${process.env.DOMAIN}/reset-password?token=${resetToken}`;
        const message = `
            <h1>Reset your password</h1>
            <p>Click the link to reset your password:</p>
            <a href="${url}">Reset Password</a>

            <p style="font-size: 0.9rem">Copy the following url into your browser if you can't click the link:</p>
            <a style="font-size: 0.9rem" href="${url}">${url}</a>
        `
        const sent = await sendMail({to: email, subject, html: message});
        if(sent) {
            sendError(res, 'RESET_PASSWORD_EMAIL_SENT');
        } else {
            sendError(res, 'PSSWD_EMAIL_SERVICE_ERROR');
            return;
        }
    } catch(err) {
        if (err instanceof Error) {
            console.error('ERR_MESSAGE:', err);
            if (err.message === 'jwt expired' || err.message === 'invalid token') {
                sendError(res, 'SESSION_EXPIRED');
            } else {
                sendError(res, 'INTERNAL_ERROR');
            }
            return;
        }
        sendError(res, 'INTERNAL_ERROR');
    }
});

userRoutes.get('/reset-password', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../public/reset-password.html'));
});

userRoutes.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, newPassword } = req.body;
        await resetPassword(token, newPassword);
        sendError(res, 'PASSWORD_RESET_SUCCESSFUL');
    } catch (err) {
        if (err instanceof Error) {
            if(err.message === 'INVALID_OR_EXPIRED_TOKEN') {
                sendError(res, 'INVALID_OR_EXPIRED_TOKEN');
                return;
            } else {
                sendError(res, 'INTERNAL_ERROR');
                return;
            }
        }
        sendError(res, 'INTERNAL_ERROR');
    }
});

userRoutes.delete('/user', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.user;
        const { userId } = req.body;

        // Only allow users to delete their own account or admins (if you have roles)
        if (userId && userId !== id) {
            res.status(403).send(sendError(res, 'NOT_AUTHORIZED'));    
            return;
        }

        const targetId = userId || id;

        // Delete related rows in child tables first
        await query('DELETE FROM posts WHERE owner_id = $1', [targetId]);
        await query('DELETE FROM endpoints WHERE owner_id = $1', [targetId]);

        // Delete the user
        await query('DELETE FROM users WHERE id = $1', [targetId]);

        res.status(200).send({ success: true, message: 'User deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).send({ code:'SERVER_ERROR', error: err instanceof Error ? err.message : err });
    }
});

export default userRoutes;

