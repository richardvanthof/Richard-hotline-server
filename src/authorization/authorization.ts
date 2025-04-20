import jwt from 'jsonwebtoken';
import type { RequestHandler, Request } from "express";

// Extend the Request interface to include the 'user' property
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

const authenticateToken:RequestHandler= (req, res, next) => {
    const secret:string|undefined = process.env.ACCESS_TOKEN_SECRET;
    const authHeaders = req.headers['authorization'] as string;
    const token:string = authHeaders && authHeaders.split(' ')[1];
    console.log({token})
    try {
        if(!token) {res.status(401).send('TOKEN_NOT_FOUND') }
        else if(!secret) {res.status(500).send('JWT Secret Access token not found')}
        else {
            return jwt.verify(token, secret, (err, user) => {
                if (err) {
                    return res.status(403).send('ACCESS_DENIED');
                }
                req.user = user;
                next();
            })
        };
        
    } catch (err) {
        res.status(403).send('INVALID_TOKEN');
    }
};


export {authenticateToken};