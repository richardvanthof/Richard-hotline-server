
import { authenticateToken } from '../authorization/authorization';
import { Request, Response, Router } from 'express';
import query, {startNotificationListener} from '../db/db_connect';
import sendMail from '../lib/send-mail';
import { z } from 'zod';
import {Client} from 'pg';
import { messageSubscribers, sendSseEvent } from '../db/sse';
import validate from '../validators/validationMiddleware';
import { 
    CreateMessageSchema,
    UpdateMessageSchema,
    DeleteMessageSchema,
    ConfirmReceiptSchema,
    GetMessagesSchema
} from '../validators/schemas/postSchemas';
const postRoutes = Router();

const getNewMessagesCount = async (userId: string): Promise<number> => {
    const queryText = `
        SELECT COUNT(*) AS total
        FROM posts
        WHERE owner_id = $1 AND printed_at IS NULL;
    `;
    const result = await query(queryText, [userId]);
    return parseInt(result.rows[0]?.total || '0', 10);
}

postRoutes.get(
    '/message', 
    authenticateToken, validate(GetMessagesSchema), 
    async (req: Request, res: Response) => {
    try {
        const { id, role }: { id: string, role: string } = req.user;
        let {
            paginate,
            status,
            scope = 'user',
            direction = 'ASC'
        }: {
            paginate?: { limit: string, page: string, totalPages?: number },
            status?: 'printed' | 'pending',
            scope: 'user' | 'global',
            direction: 'ASC' | 'DESC'
        } = req.body;

        // check that only the admin can view messages of all users.
        if (scope === 'global' && role !== 'admin') {
            return res.status(403).send({
                code: 'PERMISSION_DENIED',
                message: 'Insufficient permissions to perform this action.'
            });
        }

        let idx = 1;
        let command = 'SELECT * FROM posts p ';
        let countCommand = 'SELECT COUNT(*) AS total_posts FROM posts p ';
        let params: (string | number)[] = [];

        // Add scope
        if (scope === 'user') {
            const string = `WHERE owner_id = $${idx} `;
            command += string;
            countCommand += string;
            params.push(id);
            idx++;
        }

        // Add filter
        if (status) {
            const filterString = `${command.includes('WHERE') ? 'AND' : 'WHERE'} printed_at IS ${status === 'printed' ? 'NOT ' : ''}NULL `;
            command += filterString;
            countCommand += filterString;
        }

        // Add direction
        command += `ORDER BY created_at ${direction} `;
        let totalPosts = 0;
        // Add pagination
        if (paginate) {
            const page = Math.max(parseInt(paginate.page) || 1, 1);
            const limit = Math.max(parseInt(paginate.limit) || 10, 1);
            const offset = (page - 1) * limit;
            const countResult = await query(countCommand, params);
            totalPosts = parseInt(countResult.rows[0]?.total_posts || '0', 10);
            paginate.totalPages = Math.ceil(totalPosts / limit);

            command += `LIMIT $${idx} `;
            params.push(limit);
            idx++;

            command += `OFFSET $${idx} `;
            params.push(offset);
            idx++;
        }

        // perform query
        const resp = await query(command, params);

        res.status(200).send({
            paginate,
            count: resp.rowCount,
            total: totalPosts,
            data: resp.rows
        });

    } catch (err) {
        if (err instanceof Error) {
            res.status(500).send({
                code: 'UNKNOWN_INTERNAL_ERROR',
                message: `An unexpected error occured: ${err.message}`
            });
        } else {
            res.status(500).send({
                code: 'UNKNOWN_INTERNAL_ERROR',
                message: `An unexpected error occured: ${err}`
            });
        }
    }
});

const ImageBlockSchema = z.object({
    type: z.literal('image'),
    src: z.string()
});

const TextBlockSchema = z.object({
    type: z.literal('text'),
    content: z.string()
});

postRoutes.post('/message', 
    validate(CreateMessageSchema), async (req: Request, res: Response) => {
    try {
        const { name, email, ownerId, content } = req.body;
        console.log(content)
        const command = `
            INSERT INTO posts (name, email, content, owner_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const resp = await query(command, [name, email, JSON.stringify(content), ownerId])
        console.log(resp.rows[0]);
       
        res.status(200).send({
            code: 'POST_CREATED',
            message: 'Message created successfully.',
            data: resp.rows
        })

    } catch (err) {
        console.error(err);
        if (err instanceof Error) {
            res.status(500).send(err.message)
        } else {
            res.status(500).send(err)
        }
    }

})

postRoutes.patch('/message', 
    authenticateToken, validate(UpdateMessageSchema), 
    async (req: Request, res: Response) => {
    try {
        const {
            postId, name, email, content, printedAt }: { postId: number, name?: string, email?: string, content?: string, printedAt?: Date } = req.body;
        if (!postId) return res.status(400).send({ code: 'INVALID_INPUT', message: 'Post ID is required.' });

        const result = await query('SELECT owner_id FROM posts WHERE post_id = $1', [postId]);
        const ownerId = result.rows[0]?.owner_id;
        if (!ownerId) return res.status(404).send({ code: 'POST_NOT_FOUND', message: 'Post not found.' });

        const { id, role } = req.user;
        if (ownerId !== id && role !== 'admin')
            return res.status(403).send({ code: 'ACCESS_DENIED', message: 'No permission.' });

        const fields = [], values = [];
        if (typeof name === 'string') fields.push('name'), values.push(name);
        if (typeof email === 'string') fields.push('email'), values.push(email);
        if (typeof content === 'string') fields.push('content'), values.push(content);
        if (typeof printedAt === 'string' || printedAt instanceof Date) fields.push('printed_at'), values.push(printedAt);

        if (!fields.length) return res.status(400).send({ code: 'NO_FIELDS', message: 'No fields to update.' });

        const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        values.push(postId);
        const updateResult = await query(`UPDATE posts SET ${set}, updated_at = NOW(), WHERE post_id = $${fields.length + 1} RETURNING *`, values);

        res.status(200).send({ code: 'POST_UPDATED', message: 'Post updated.', data: updateResult.rows[0] });
    } catch (err) {
        res.status(500).send({ code: 'SERVER_ERROR', message: 'Error updating post.' });
    }
});

postRoutes.delete(
    '/message', authenticateToken, 
    validate(DeleteMessageSchema), 
    async (req: Request, res: Response) => {
    try {
        const { postId } = req.body;

        // Validate postId
        if (!postId) {
            return res.status(400).send({ code: 'INVALID_POST_ID', message: 'Post ID is required.' });
        }

        // Check if the post exists and get the owner_id
        const result = await query('SELECT owner_id FROM posts WHERE post_id = $1', [postId]);
        const ownerId = result.rows[0]?.owner_id;

        if (!ownerId) {
            return res.status(404).send({ code: 'POST_NOT_FOUND', message: 'Post not found.' });
        }

        // Check if the user is the owner or an admin
        const { id, role } = req.user;
        if (ownerId !== id && role !== 'admin') {
            return res.status(403).send({ code: 'ACCESS_DENIED', message: 'You do not have permission to delete this post.' });
        }

        // Delete the post
        const deleteResult = await query('DELETE FROM posts WHERE post_id = $1 RETURNING *', [postId]);
        const deletedPost = deleteResult.rows[0];

        res.status(200).send({
            code: 'POST_DELETED',
            message: `Post with ID ${postId} has been deleted successfully.`
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ code: 'SERVER_ERROR', message: 'An error occurred while deleting the post.' });
    }
});


postRoutes.patch('/confirm-receipt', 
    authenticateToken, 
    validate(ConfirmReceiptSchema), 
    async (req: Request, res: Response) => {
    try {
        let { messages } = req.body;
        const { id, username } = req.user;
        console.log({ id, username });
        console.log(messages);
        // Ensure messages is an array
        messages = Array.isArray(messages) ? messages : [messages];

        if (messages.length <= 0) {
            return res.status(400).send({
                code: 'MESSAGES_UNDEFINED',
                message: 'Please provide the message(s) to confirm.',
            });
        }

        // Process each message
        const results = await Promise.all(
            messages.map(async ({ postId, email }: { postId: number; email: string }) => {
                console.log({ postId })
                if (!postId) {
                    return {
                        code: 'POST_ID_UNDEFINED',
                        message: 'Post ID is undefined.'
                    }
                }
                // Update the post
                const resp = await query(
                    `
                    UPDATE posts 
                    SET printed_at = NOW(), updated_at = NOW() 
                    WHERE post_id = $1 AND owner_id = $2 
                    RETURNING *`,
                    [postId, id]
                );
                console.log(resp.rows);
                if (resp.rows.length > 0) {
                    // Send email notification
                    await sendMail({
                        to: email,
                        subject: `Your message to ${username} was printed`,
                        html: `
                        <div>
                            <h1>Your message to ${username} has been printed.</h1>
                            <p>Your message has been delivered to ${username}.<br>
                            A reaction will come ASAP.</p> 
                            <ul>
                                <li>ID: ${postId}</li>
                            </ul>
                        </div>
                        `,
                    });
                   
                } else {
                    return {
                        postId: postId,
                        code: 'MESSAGE_NOT_FOUND',
                        error: 'Message not found in your account.'
                    }
                };



                return { resp: resp.rows[0], postId, id };
            })
        );

        res.status(200).send({
            results,
        });
    } catch (err) {
        if (err instanceof Error) {
            res.status(500).send({ code: 'SERVER_ERROR', message: err.message });
        } else {
            res.status(500).send({ code: 'UNKNOWN_ERROR', message: err });
        }
    }
});

postRoutes.patch('/status', 
    authenticateToken, 
    validate(GetMessagesSchema), 
    async (req: Request, res: Response) => {
    try {
        const { id } = req.user;
        const count = await getNewMessagesCount(id);
        res.status(200).send({ count });
    } catch (err) {
        res.status(500).send(err)
    }
})

postRoutes.get(
    "/messages-available",
    authenticateToken,
    async (req: Request, res: Response) => {
        const { id } = req.user;

        res.status(200);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        const subscribers = messageSubscribers.get(id) ?? new Set<Response>();
        subscribers.add(res);
        messageSubscribers.set(id, subscribers);

        const initialCount = await getNewMessagesCount(id);
        sendSseEvent(res, "message-count", {
            count: initialCount,
            hasMessages: initialCount > 0,
        });

        const heartbeatId = setInterval(() => {
            sendSseEvent(res, "ping", { time: new Date().toISOString() });
        }, 25000);

        req.on("close", () => {
            clearInterval(heartbeatId);
            subscribers.delete(res);
            if (subscribers.size === 0) {
                messageSubscribers.delete(id);
            }
            res.end();
        });
    }
);

export default postRoutes;