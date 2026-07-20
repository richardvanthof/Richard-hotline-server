import query from './db_connect';

const initDB = async () => {
    const statements = [
        `
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
            reset_token_expiry TIMESTAMP,
            refresh_tokens TEXT[]
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS posts (
            post_id SERIAL UNIQUE PRIMARY KEY,
            owner_id INTEGER REFERENCES users(id),
            content JSONB NOT NULL,
            email VARCHAR(75) NOT NULL,
            name VARCHAR(75) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            printed_at TIMESTAMP
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS endpoints (
            endpoint_id SERIAL UNIQUE PRIMARY KEY,
            uuid VARCHAR(75) UNIQUE NOT NULL,
            owner_id INTEGER REFERENCES users(id),
            type VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP
        );
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_owner_id_printed_at ON posts (owner_id, printed_at);
        `
    ];

    try {
        for (const statement of statements) {
            await query(statement);
        }
        console.log('Database tables created');
    } catch (err) {
        if (err instanceof Error) {
            console.error('Error creating tables:', err.message);
            throw err.message;
        } else {
            throw err;
        }
    }
};

export default initDB;

