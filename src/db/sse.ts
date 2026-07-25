// sse.ts
import { Response } from "express";

export const messageSubscribers = new Map<number, Set<Response>>();

export function sendSseEvent(res: Response, event: string, data: unknown) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}