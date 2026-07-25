// pgListener.ts
import { Client } from "pg";
import { messageSubscribers, sendSseEvent } from "./sse";

let listenerClient: Client | null = null;
let reconnecting = false;

async function connect() {
    const config = {
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST ?? "localhost",
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: Number(process.env.POSTGRES_PORT ?? 5432),
    };
    const client = new Client(config);

    client.on("error", (err) => {
        console.error("PG listener connection error:", err.message);
        scheduleReconnect();
    });

    client.on("end", () => {
        console.warn("PG listener connection closed.");
        scheduleReconnect();
    });

    client.on("notification", (msg) => {
        if (msg.channel !== "messages_available" || !msg.payload) return;

        let payload: { userId: number; count: number; hasMessages: boolean };
        try {
            payload = JSON.parse(msg.payload);
        } catch (err) {
            console.error("Failed to parse notification payload:", err);
            return;
        }

        const subscribers = messageSubscribers.get(payload.userId);
        if (!subscribers || subscribers.size === 0) return;

        for (const res of subscribers) {
            sendSseEvent(res, "message-count", {
                count: payload.count,
                hasMessages: payload.hasMessages,
            });
        }
    });

    await client.connect();
    await client.query("LISTEN messages_available");
    listenerClient = client;
    console.log("Listening for messages_available notifications.");
}

function scheduleReconnect() {
    if (reconnecting) return;
    reconnecting = true;
    listenerClient = null;
    setTimeout(async () => {
        reconnecting = false;
        try {
            await connect();
        } catch (err) {
            console.error("Reconnect failed, retrying...", err);
            scheduleReconnect();
        }
    }, 2000);
}

async function startMessageListener() {
    await connect();
}

export default startMessageListener;