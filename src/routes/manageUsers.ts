import {app} from '../index';
import express, { Express, Request, Response, Application } from 'express';
import query from '../db/db_connect';

// Authentication
import { createUser, login, generateToken, generateResetToken, resetPassword, getRefreshTokens } from '../authentication/authenticate';
import { authenticateToken } from '../authorization/authorization';

import { inputValidationConfig } from '../lib/validatorContext';
import sendMail from '../lib/send-mail';

// ACCOUNT MANAGEMENT
app.post('/users', async (req: Request, res: Response):Promise<void> => {
    try {
        const resp = await createUser(req.body);
        res.status(201).send(resp);
    } catch(err) {
        res.status(500).send(err)
    }
    });

    app.get('/users', authenticateToken, async (req: Request, res: Response):Promise<void> => {
    res.send('success')
});

// Authenticate
app.post('/login', async (req: Request, res: Response):Promise<void> => {
    try {
        const {username, password} = req.body;
        const authenticated = await login(username, password);
        if(authenticated.success) {
        if(!process.env.ACCESS_TOKEN_SECRET) {res.status(500).send('Access token secret not found')};
        if(!process.env.REFRESH_TOKEN_SECRET) {res.status(500).send('Refresh token secret not found')};
        const {id, username} = authenticated.user;
        if(id) {
            const userData = {id, username};
            const refreshToken = await generateToken(userData, process.env.REFRESH_TOKEN_SECRET || '');
            let refreshTokens = await getRefreshTokens(id);
            refreshTokens.push(refreshToken);
            await query('UPDATE users SET refresh_tokens = $1 WHERE id = $2', [refreshTokens, id]);
            const accessToken = await generateToken(userData, process.env.ACCESS_TOKEN_SECRET || '', process.env.ACCESS_TOKEN_EXPIRATION);
            res.status(200).send({
            success: true,
            accessToken,
            accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION,
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
  
app.post('/refresh', async (req: Request, res: Response):Promise<void> => {
try {
    const authHeaders = req.headers['authorization'] as string;
    const refreshToken:string = authHeaders && authHeaders.split(' ')[1];
    if(!refreshToken) {
    res.status(401).send('REFRESH_TOKEN_NOT_FOUND');
    } else if(!process.env.REFRESH_TOKEN_SECRET) {
    res.status(500).send('Refresh token secret not found');
    } else {
    const user = await jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const accessToken = await generateToken(user, process.env.ACCESS_TOKEN_SECRET || '', process.env.ACCESS_TOKEN_EXPIRATION);
    res.status(200).send({
        success: true,
        accessToken,
        accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION,
    });
    }
} catch(err) {
    if (err instanceof Error) {
    if(err.message === 'jwt expired' || err.message === 'invalid token') {
        res.status(403).send('NOT_AUTHORIZED');
    } else {
        res.status(500).send(err.message);
    }
    }
}
}); 

app.delete('/logout', authenticateToken, async (req: Request, res: Response):Promise<void> => {
    try {
        const {id} = req.user.userData;
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

app.delete('/logout-all', authenticateToken, async (req: Request, res: Response):Promise<void> => {
    try {
        const {id} = req.user.userData;
        if(id) {
        await query('UPDATE users SET refresh_tokens = $1 WHERE id = $2', [[], id]);
        res.status(403).send('LOGGED_OUT_ALL');
        } 
    } catch(err) {
        if (err instanceof Error) {
        res.status(500).send(err.message);
        }
        res.status(500).send(err)
    }
});

app.post('/forgot-password', async (req: Request, res: Response):Promise<void> => {
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

app.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
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

app.delete('/user', authenticateToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const {id} = req.user.userData;
        const {userId} = req.body;
        
        // Only allow users to delete their own account or admins (if you have roles)
        if(userId && userId !== id) {
            res.status(403).send('NOT_AUTHORIZED');
        }

        await query('DELETE FROM users WHERE id = $1', [userId || id]);
        res.status(200).send({ success: true, message: 'User deleted successfully.' });
    } catch (err) {
        res.status(500).send({ success: false, error: err instanceof Error ? err.message : err });
    }
});

