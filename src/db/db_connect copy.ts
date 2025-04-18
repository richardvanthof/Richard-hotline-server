import { Pool } from 'pg';

export const pool = new Pool({
    user: process.env.POSTGRES_USER || ,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

const query = async (text: string, params?: any[]) => {
   
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release();
    }
};

export default query;