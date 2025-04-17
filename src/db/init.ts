import query from './db_connect';

const createUsersTable = async () => {
    const text = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            first_name VARCHAR(50) NOT NULL,
            last_name VARCHAR(50) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role VARCHAR(20) DEFAULT 'user',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            last_login TIMESTAMP,
            reset_token TEXT,
            reset_token_expiry TIMESTAMP
        );
    `;

    try {
        await query(text);
        console.log('Users table created successfully.');
    } catch (error) {
        console.error('Error creating users table:', error);
    }
};

const initDB = async () => {
    await createUsersTable();
    // Add other table creation functions here
}

export {createUsersTable};
export default initDB;

