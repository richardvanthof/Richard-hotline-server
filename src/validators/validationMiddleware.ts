import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validate = (
    schema: ZodSchema, 
    target: "body" | "query" = "body"
) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            req[target] = schema.parse(req[target]);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                return res.status(400).json({
                    code: "VALIDATION_ERROR",
                    errors: err.issues,
                });
            }

            next(err);
        }
    };

export default validate;