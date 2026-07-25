import { Pool, Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const config = {
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST ?? "localhost",
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
};

const pool = new Pool(config);

const listener = new Client(config);

export const query = async (text: string, params?: any[]) => {
    const client = await pool.connect();

    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
};

export const startNotificationListener = async (
    userId: string,
    onNotification: (payload: string) => void
) => {

    listener.on("notification", (msg) => {
        if (!msg.payload) return;

        const payload = JSON.parse(msg.payload);
        if (payload.userId === userId) {
            onNotification(msg.payload);
        }
    });
};

export default query;