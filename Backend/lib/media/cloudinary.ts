import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

/**
 * Validates whether the required Cloudinary environment variables are configured.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Initializes and configures the Cloudinary v2 SDK instance.
 */
export function getCloudinaryClient() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary credentials are not configured. Please define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the environment.'
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface CloudinaryUploadOptions {
  folder?: string;
  allowedFormats?: string[];
  maxBytes?: number;
  tags?: string[];
}

/**
 * Uploads a file buffer directly to Cloudinary using upload_stream.
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const client = getCloudinaryClient();

  const folder = options.folder || 'restrauque/products';
  const allowedFormats = options.allowedFormats || ['jpg', 'jpeg', 'png', 'webp'];

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: allowedFormats,
        tags: options.tags || ['product', 'restrauque'],
      },
      (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
        if (error) {
          // Sanitize error message to avoid leaking secrets
          const sanitizedMessage = error.message || 'Unknown Cloudinary upload error';
          return reject(new Error(`Cloudinary upload failed: ${sanitizedMessage}`));
        }

        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary upload returned empty response or missing secure URL'));
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(buffer);
  });
}
