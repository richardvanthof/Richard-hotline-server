import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    user: process.env.POSTGRES_USER, // Provide a default value
    host: process.env.POSTGRES_HOST, // Default to localhost if undefined
    database: process.env.POSTGRES_DB, // Provide a default database name
    password: process.env.POSTGRES_PASSWORD, // Provide a default password
    port: 5432 // Default to port 5432
});

const query = async (text: string, params?: any[]) => {
    console.log(process.env.POSTGRES_USER); //
   
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release();
    }
};

export default query;