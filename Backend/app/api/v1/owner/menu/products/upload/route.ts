import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ValidationError, AppError } from '@/lib/http/errors';
import {
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
} from '@/lib/media/cloudinary';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/v1/owner/menu/products/upload
 *
 * Authenticated endpoint for restaurant owners to upload product images to Cloudinary.
 * Validates multipart formData, MIME type, and file size before transmitting to Cloudinary.
 * Does not write to the database; returns canonical Cloudinary HTTPS secure_url and public_id.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user and verify restaurant ownership
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // 2. Parse multipart FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ValidationError(
        'Invalid multipart/form-data request. Please submit a valid file payload.'
      );
    }

    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      throw new ValidationError(
        'An image file is required. Please provide a file under the "file" form field.'
      );
    }

    // 3. Validate file MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new ValidationError(
        `Unsupported file type "${file.type || 'unknown'}". Allowed formats: JPEG (.jpg, .jpeg), PNG (.png), and WebP (.webp).`
      );
    }

    // 4. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      throw new ValidationError(
        `File size (${sizeMb} MB) exceeds the maximum allowed limit of 5 MB. Please select a smaller image.`
      );
    }

    if (file.size === 0) {
      throw new ValidationError('Uploaded file is empty (0 bytes).');
    }

    // 5. Check Cloudinary configuration
    if (!isCloudinaryConfigured()) {
      throw new AppError(
        'Image upload service is currently unavailable. Cloudinary credentials are not configured on the server.',
        503,
        'SERVICE_UNAVAILABLE'
      );
    }

    // 6. Convert file ArrayBuffer to Buffer and upload to Cloudinary
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let uploadResult;
    try {
      uploadResult = await uploadBufferToCloudinary(buffer, {
        folder: `restrauque/restaurants/${restaurantId}/products`,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
        tags: ['product', `restaurant_${restaurantId}`],
      });
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : 'Unknown provider error';
      throw new AppError(
        `Failed to upload image: ${msg.replace(/^Cloudinary upload failed:\s*/i, '')}`,
        502,
        'PROVIDER_ERROR'
      );
    }

    return successResponse(
      {
        secureUrl: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
