import query from '../db/db_connect';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';

type UserData = {
    firstName: string;
    lastName: string,
    email: string,
    username: string,
    password: string,
    id?: number | string
}

const createUser = async (data:UserData, role: 'user'|'admin' = 'user') => {
    const {firstName, lastName, email, username, password} = data;

    try {
        const salt = await bcrypt.genSaltSync();
        const hashedPassword = await bcrypt.hashSync(password, salt);
        const text = `
            INSERT INTO users (first_name, last_name, email, username, password, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
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

const login = async (username: string, password: string):Promise<{success: boolean, user: UserData}> => {
    try {
        const user = await query('SELECT * FROM users WHERE username = $1 or email = $1', [username]);
        if (user.rows.length === 0) {
            throw new Error('USER_NOT_FOUND');
        }
        const userData = user.rows[0]
        const isMatch = await bcrypt.compare(password, userData.password);
        if (!isMatch) {
            throw new Error('INVALID_PASSWORD');
        } else {
            return {
                success: true,
                user: userData
            };
        }
    } catch (err) {
        console.error('Error authenticating:', err);
        throw err;
    }

};

/** Generates access or refresh token */
const generateToken = (userData:string | JwtPayload, secret: string, expration?:any):string => {
    if (!secret) throw new Error('Refresh or Access token secret not found');
    console.log(userData)
    return jwt.sign({userData}, secret, expration ? {expiresIn: expration} : {});
};

const generateResetToken = async (email: string): Promise<string> => {
    try {
        const user = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            throw new Error('USER_NOT_FOUND');
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        await query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3', [resetToken, resetTokenExpiry, email]);

        return resetToken;
    } catch (err) {
        console.error('Error generating reset token:', err);
        throw err;
    }
};

export {createUser, login, generateToken, generateResetToken};