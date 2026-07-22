import { Router, Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import DatauriParser from "datauri/parser";
import { authenticateToken } from "../authorization/authorization";

const uploadRoutes = Router();

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UploadedImages {
  uris: string[];
}

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
  files: Express.Multer.File[];
}

// -----------------------------------------------------------------------------
// Cloudinary
// -----------------------------------------------------------------------------

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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

const datauriParser = new DatauriParser();

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

uploadRoutes.post(
  "/images",
  authenticateToken,
  upload.array("images"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const images = await uploadImages(
        (req as AuthenticatedRequest).user.id,
        req.body.path,
        (req as AuthenticatedRequest).files
      );

      res.status(200).json(images);
    } catch (err) {
      console.error("Cloudinary upload failed:", err);

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
  path: string | undefined,
  files: Express.Multer.File[]
): Promise<UploadedImages> {
  if (!userId) {
    throw new Error("Missing user id.");
  }

  if (!files || files.length === 0) {
    throw new Error("No files uploaded.");
  }

  // Prevent weird folder names
  const safeFolder = (path ?? "message-assets").replace(
    /[^a-zA-Z0-9/_-]/g,
    ""
  );

  const options = {
    folder: `hotline/${userId}/${safeFolder}`,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  };

  const uploadedUrls = await Promise.all(
    files.map(async (file) => {
      const dataUri = datauriParser.format(
        file.originalname,
        file.buffer
      ).content;

      if (!dataUri) {
        throw new Error(`Failed to parse ${file.originalname}`);
      }

      const result = await cloudinary.uploader.upload(
        dataUri,
        options
      );

      return result.secure_url;
    })
  );

  return {
    uris: uploadedUrls,
  };
}

export default uploadRoutes;