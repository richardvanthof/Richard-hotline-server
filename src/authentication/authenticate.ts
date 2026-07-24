import query from '../db/db_connect';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';

export type UserData = {
    firstName: string;
    lastName: string,
    email: string,
    username: string,
    password: string,
    id?: number | string,
    role?: string
}

export type AccountData = {
    data: UserData;
    role: 'user' | 'admin';
}

const createUser = async (data:UserData):Promise<AccountData> => {
    const {firstName, lastName, email, username, password} = data;
    const role = 'user';
    try {
        const salt = await bcrypt.genSaltSync();
        const hashedPassword = await bcrypt.hashSync(password, salt);
        const text = `
            INSERT INTO users (first_name, last_name, email, username, password, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, first_name, last_name, email, username, role;
        `;
        const values = [firstName, lastName, email, username, hashedPassword, role];
        const res = await query(text, values);
        console.log('User created successfully:', res.rows[0]);
        return res.rows[0];
    } catch (err) {
        console.error('Error creating user:', err);
        throw err;
    }
};

const login = async (username: string, password: string): Promise<{ success: boolean; user: UserData }> => {
    try {
        const user = await query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
        if (user.rows.length === 0) {
            throw new Error('USER_NOT_FOUND');
        }

        const userData = user.rows[0];
        const isMatch = await bcrypt.compare(password, userData.password);
        if (!isMatch) {
            throw new Error('INVALID_PASSWORD');
        }

        // Update last_login field
        await query(
            `UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING *`,
            [userData.id]
        );

        return {
            success: true,
            user: userData,
        };
    } catch (err) {
        console.error('Error authenticating:', err);
        throw err;
    }
};

/** Generates access or refresh token */
const generateToken = (data:string | JwtPayload, secret: string, expration?:any):string => {
    if (!secret) throw new Error('Refresh or Access token secret not found');
    console.log({data})
    return jwt.sign(data, secret, expration ? {expiresIn: expration} : {});
};

const getRefreshTokens = async (userId: string|number):Promise<string[]> => {
    try {
        console.log(userId);
        const tokens = await query('SELECT refresh_tokens FROM users WHERE id = $1', [userId]);
        return tokens.rows[0].refresh_tokens || [];
    } catch (err) {
        console.error('Error getting refresh tokens:', err);
        throw err;
    }
};

const generateResetToken = async (email: string): Promise<string> => {
    try {
        const user = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            throw new Error('USER_NOT_FOUND');
           
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        await query('UPDATE users SET reset_token = $1, updated_at = NOW(), reset_token_expiry = $2 WHERE email = $3', [resetToken, resetTokenExpiry, email]);

        return resetToken;
    } catch (err) {
        console.error('Error generating reset token:', err);
        throw err;
    }
};

const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    try {
        const user = await query('SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()', [token]);
        if (user.rows.length === 0) {
            throw new Error('INVALID_OR_EXPIRED_TOKEN');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password = $1, reset_token = NULL, updated_at = NOW(), reset_token_expiry = NULL WHERE id = $2', [hashedPassword, user.rows[0].id]);
        
        console.log('Password reset successfully.');
    } catch (err) {
        console.error('Error resetting password:', err);
        throw err;
    }
};

const deleteUser = async (userId: number | string): Promise<void> => {
    try {
        const res = await query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);
        if (res.rows.length === 0) {
            throw new Error('USER_NOT_FOUND');
        }
        console.log('User deleted successfully:', res.rows[0]);
    } catch (err) {
        console.error('Error deleting user:', err);
        throw err;
    }
};

export {createUser, deleteUser, login, generateToken, generateResetToken, resetPassword, getRefreshTokens};