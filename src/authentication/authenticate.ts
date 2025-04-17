import query from '../db/db_connect';
import bcrypt from 'bcrypt';

type UserData = {
    firstName: string;
    lastName: string,
    email: string,
    username: string,
    password: string
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

const login = async (username: string, password: string):Promise<boolean> => {
    try {
        const user = await query('SELECT * FROM users WHERE username = $1 or email = $1', [username]);
        if (user.rows.length === 0) {
            throw new Error('USER_NOT_FOUND');
        }
        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) {
            throw new Error('INVALID_PASSWORD');
        } else {
            return true;
        }
    } catch (err) {
        console.error('Error authenticating:', err);
        throw err;
    }

};

export {createUser, login};