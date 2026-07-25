import {Router, Request, Response} from 'express';
import {authenticateToken} from '../authorization/authorization';
import query from '../db/db_connect';

const endPointRoutes = Router();

endPointRoutes.get('/endpoint', authenticateToken, async (req: Request, res: Response) => {
    try {
        const {id, role} = req.user;
        const {scope = 'user'}:{scope: 'user'|'global'} = req.body;
        if(scope === 'global' || role !== 'admin') {
            res.status(403).send({
                code: 'NOT_AUTHORIZED',
                message: 'You are not authorized to use this scope.'
            })
        }
        const sql = `SELECT * FROM endpoints ${scope !== 'global' && 'AND WHERE owner_id = $1'} RETURN *`;
        const resp = await query(sql, [id])
        res.status(200).send(resp.rows);
    } catch (err) {
        res.status(500).send(err);
    }
})


endPointRoutes.post('/endpoint', authenticateToken, async (req: Request, res: Response) => {
    try {
        const {id} = req.user;
        const {type, uuid, status} = req.body;
        if(!type || !uuid || !status) {
            return res.status(400).send({
                code: 'INVALID_PARAMS',
                message: 'Please provide a valid endpoint type, uuid and status.'
            });
        }
    
        const command = `
            INSERT INTO endpoints 
            (uuid, owner_id, type, status, created_at, updated_at)
            SELECT $1, $2, $3, $4, NOW(), NOW()
            WHERE NOT EXISTS (
            SELECT 1 FROM endpoints WHERE uuid = $1
            )
            RETURNING *
        `;
    
        const resp = await query(command, [uuid, id, type, status]);
        res.send(resp.rows);

    } catch(err) {
        if(err instanceof Error) {
            if(err.message.includes('duplicate key')) {
                res.status(401).send({
                    code: 'ENDPOINT_ALREADY_EXISTS',
                    message: 'Your UUID already registered.'
                })
            }
            console.error(err)
            res.status(500).send(err.message);
        }
        console.error(err);
        res.status(500).send(err);
    }
})

endPointRoutes.delete('/endpoint', authenticateToken, async (req: Request, res: Response) => {
    try {
        const {id} = req.user;
        const {uuid} = req.body;

        const sql = 'DELETE * FROM endpoints WHERE owner_id = $1 AND uuid = $2 RETURN *';

        const resp = await query(sql, [id, uuid]);

        res.status(200).send(resp);
    } catch (err) {
        res.status(500).send(err);
    }
})

export default endPointRoutes;