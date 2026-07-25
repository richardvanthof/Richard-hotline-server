import { Pool, Client } from "pg";
import dotenv from "dotenv";

dotenv.config();
import config from "./config";


const pool = new Pool({
    ...config,
    host: process.env.POSTGRES_HOST_POOLED || process.env.POSTGRES_HOST,
});

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