import { z } from "zod";

// min/max now live inside the helper, applied before the transform
const sanitizeString = (min: number, max: number) =>
    z.string()
        .trim()
        .min(min)
        .max(max)
        .transform(value => value.replace(/\s+/g, " "));

const emailSchema = z.string().trim().email();

const ImageBlockSchema = z.object({
    type: z.literal("image"),
    src: z.string().trim().url(),
});

const TextBlockSchema = z.object({
    type: z.literal("text"),
    content: sanitizeString(1, 5000),
});

export const MessageContentSchema = z.array(
    z.union([ImageBlockSchema, TextBlockSchema])
).min(1);

export const CreateMessageSchema = z.object({
    name: sanitizeString(1, 100),

    email: emailSchema,

    ownerId: z.string(),

    content: MessageContentSchema,
}).strict();

export const UpdateMessageSchema = z.object({
    postId: z.coerce.number().int().positive(),

    name: sanitizeString(1, 100).optional(),

    email: emailSchema.optional(),

    content: MessageContentSchema.optional(),

    printedAt: z.coerce.date().optional(),
})
.refine(
    data =>
        data.name !== undefined ||
        data.email !== undefined ||
        data.content !== undefined ||
        data.printedAt !== undefined,
    {
        message: "At least one field must be updated.",
    }
);


export const DeleteMessageSchema = z.object({
    postId: z.coerce.number().int().positive(),
});

export const ConfirmReceiptSchema = z.object({
    messages: z.array(
        z.object({
            postId: z.coerce.number().int().positive(),
            email: emailSchema,
        })
    ).min(1),
});

export const GetMessagesSchema = z.object({
    paginate: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(10),
    }).optional(),

    status: z.enum(["printed", "pending"]).optional(),

    scope: z.enum(["user", "global"]).default("user"),

    direction: z.enum(["ASC", "DESC"]).default("ASC"),
});