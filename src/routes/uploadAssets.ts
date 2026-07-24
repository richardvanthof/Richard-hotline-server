import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { authenticateToken } from "../authorization/authorization";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

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

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
    files: 10,
  },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed."));
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
    console.log("images", uploadRequest.body.images, "files", uploadRequest.files)
    try {
      const images = await uploadImages(
        uploadRequest.body.userId,
        uploadRequest.files
      );

      console.log(images)

      res.status(200).json(images);
    } catch (err) {
      console.error("R2 upload failed:", err);

      res.status(500).json({
        error: "Failed to upload images.",
      });
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
    throw new Error("Missing user id.");
  }

  if (!files || files.length === 0) {
    throw new Error("No files uploaded.");
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

    uploadedUrls.push(publicUrl);
  }

  return {
    uris: uploadedUrls,
  };
  
}

export default uploadRoutes;