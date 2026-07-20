import { Request, Response, Router } from 'express';
import query from '../db/db_connect';

// Authentication
import { createUser, login, generateToken, generateResetToken, resetPassword, getRefreshTokens } from '../authentication/authenticate';
import { authenticateToken } from '../authorization/authorization';

import { inputValidationConfig } from '../lib/validatorContext';
import sendMail from '../lib/send-mail';
import jwt from 'jsonwebtoken';

const userRoutes = Router()

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

// ACCOUNT MANAGEMENT
userRoutes.post('/users', async (req: Request, res: Response):Promise<void> => {
    try {
        const resp = await createUser(req.body);
        res.status(201).send(resp);
    } catch(err) {
        res.status(500).send(err)
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
        if(!process.env.ACCESS_TOKEN_SECRET) {res.status(500).send('Access token secret not found')};
        if(!process.env.REFRESH_TOKEN_SECRET) {res.status(500).send('Refresh token secret not found')};
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
        }
        
    } catch(err) {
        if (err instanceof Error) {
        if(err.message === 'USER_NOT_FOUND' || err.message === 'INVALID_PASSWORD') {
            res.status(401).send('NOT_AUTHORIZED');
        } else {
            res.status(500).send(err.message);
        }
        }
    }
});
  
userRoutes.post('/refresh', async (req: Request, res: Response):Promise<void> => {
try {
    const authHeaders = req.headers['authorization'] as string;
    const refreshToken:string = authHeaders && authHeaders.split(' ')[1];
    if(!refreshToken) {
        res.status(401).send({
            code: 'REFRESH_TOKEN_NOT_FOUND',
            message: 'Please provide a refresh token to renew your access key.'
        });
    } else if(!process.env.REFRESH_TOKEN_SECRET) {
        res.status(500).send({
            code: 'REFRESH_TOKEN_SECRET_UNDEFINED',
            message: 'Refresh token secret has not been set up.'
        });
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
        res.status(403).send({
            code: 'INVALID_CREDENTIALS',
            message: err.message
        });
    } else {
        res.status(500).send(err.message);
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
            res.status(403).send('LOGGED_OUT');
        } else {
            res.status(403).send('NOT_AUTHORIZED');
        }
        } 
    } catch(err) {
        if (err instanceof Error) {
        if(err.message === 'jwt expired' || err.message === 'invalid token') {
            res.status(403).send('SESSION_EXPIRED');
        } else {
            res.status(500).send(err.message);
        }
        }
        res.status(500).send(err)
    }
});

userRoutes.delete('/logout-all', authenticateToken, async (req: Request, res: Response):Promise<void> => {
    try {
        const {id} = req.user.userData;
   
        if(id) {
            await query('UPDATE users SET refresh_tokens = $1 WHERE id = $2', [[], id]);
            res.status(403).send('LOGGED_OUT_ALL');
        } else {
            res.status(500).send('ID_NOT_FOUND')
        }
    } catch(err) {
        if (err instanceof Error) {
            res.status(500).send(err.message);
            return;
        }
        res.status(500).send(err);
    }
});

userRoutes.post('/forgot-password', async (req: Request, res: Response):Promise<void> => {
    try {
        const {email} = req.body;
        if(!email) { res.status(300).send('EMAIL_UNDEFINED')}; 
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
        res.status(200).send("RESET_PASSWORD_EMAIL_SENT");
        } else {
        res.status(500).send("PSSWD_EMAIL_SERVICE_ERROR");
        }
    } catch(err) {
        if (err instanceof Error) {
        if(err.message === 'USER_NOT_FOUND') {
            res.status(404).send(err.message);
        } else if (err.message.includes('invalid username or password')) {
            res.status(500).send('INVALID_INTERNAL_SMTP_AUTH')
        } else {
            res.status(500).send(err.message);
        }
        res.status(500).send(err.message);
        }
        res.status(500).send(err)
    }
});

userRoutes.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, newPassword } = req.body;
        await resetPassword(token, newPassword);
        res.status(200).send('Password reset successfully.');
    } catch (err) {
        if (err instanceof Error) {
        if(err.message === 'INVALID_OR_EXPIRED_TOKEN') {
            res.status(403).send(err.message);
        } else {
            res.status(500).send(err.message);
        }
        }
        res.status(500).send(err);
    }
});

userRoutes.delete('/user', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.user;
        const { userId } = req.body;

        // Only allow users to delete their own account or admins (if you have roles)
        if (userId && userId !== id) {
            res.status(403).send('NOT_AUTHORIZED');
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

