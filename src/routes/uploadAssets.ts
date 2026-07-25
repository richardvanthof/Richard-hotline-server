import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { authenticateToken } from "../authorization/authorization";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { query } from "../db/db_connect";
import sendError from "../errorHandling/errorHandler";

const uploadRoutes = Router();

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UploadedImages {
  uris: string[];
}

// -----------------------------------------------------------------------------
// Cloudflare R2 Configuration
// -----------------------------------------------------------------------------

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "hotline-assets";
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "";

// -----------------------------------------------------------------------------
// Multer
// -----------------------------------------------------------------------------

const storage = multer.memoryStorage();
const maxFileSize = 500000; // 500kb
export const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSize, // 500kb per image
    files: 3,
  },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("ONLY_IMAGES_ALLOWED"));
      return;
    }
    if (file.size > maxFileSize) {
      cb(new Error("FILE_TOO_LARGE"));
      return;
    }
    cb(null, true);
  },
});

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

type UploadRequest = Request & {
  body: {
    userId: string;
    images: string[];
  };
  files: Express.Multer.File[];
};

uploadRoutes.post(
  "/images",
  upload.array("images"),
  async (req: Request, res: Response): Promise<void> => {
    const uploadRequest = req as UploadRequest;
    const files = uploadRequest.files;
    try {
      const userId = uploadRequest.body.userId;
      const recipientExists = await query('SELECT 1 FROM users WHERE id = $1', [userId]);
      if (recipientExists.rowCount === 0) {
        sendError(res, 'INVALID_RECIPIENT');
        return;
      }
      const images = await uploadImages(
        userId,
        files
      );

      console.log(images)

      res.status(200).json(images);
    } catch (err) {
      console.error("R2 upload failed:", err);
      if(err instanceof Error) {
        sendError(res, err.message);
        return;
      };
      sendError(res, 'INTERNAL_ERROR');
      return;
    }
  }
);

// -----------------------------------------------------------------------------
// Upload helper
// -----------------------------------------------------------------------------

export async function uploadImages(
  userId: string,
  files: Express.Multer.File[]
): Promise<UploadedImages> {
  if (!userId) {
    throw new Error("USER_ID_UNDEFINED");
  }

  

  if (!files || files.length === 0) {
    throw new Error("FILES_UNDEFINED");
  }

  const uploadedUrls: string[] = [];

  for (const file of files) {
    const objectKey = `userdata/${userId}/message-assets/${Date.now()}-${file.originalname}`;

    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: "inline",
    };

    const res = await r2Client.send(new PutObjectCommand(uploadParams));
    console.info(res);
    // Construct public URL
    let publicUrl: string;
    if (R2_PUBLIC_DOMAIN) {
      publicUrl = `https://${R2_PUBLIC_DOMAIN}/${objectKey}`;
    } else {
      // Generate a pre-signed URL that expires in 1 year (or use your preferred TTL)
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
      });
      publicUrl = await getSignedUrl(r2Client, command, { expiresIn: 31536000 });
    }

    uploadedUrls.push(encodeURI(publicUrl));
  }

  return {
    uris: uploadedUrls,
  };
  
}

export default uploadRoutes;