import { Injectable, BadRequestException } from '@nestjs/common';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ApiErrorCode } from '@dokandesk/shared';

export interface UploadedFileDto {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ImageUploadService {
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly maxSizeBytes = 5 * 1024 * 1024; // 5 MB

  /**
   * Validates and saves an uploaded product image to local storage.
   */
  async saveProductImage(
    tenantId: string,
    file: { filename: string; mimetype: string; size: number; buffer: Buffer },
  ): Promise<{ url: string; filename: string; size: number }> {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Invalid file format. Allowed formats: JPEG, PNG, WebP',
      });
    }

    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'File size exceeds maximum allowed limit of 5 MB',
      });
    }

    const ext = file.mimetype.split('/')[1] || 'png';
    const fileId = crypto.randomUUID();
    const safeFilename = `${fileId}.${ext}`;

    const tenantUploadDir = path.resolve(process.cwd(), 'uploads', 'products', tenantId);
    await fs.mkdir(tenantUploadDir, { recursive: true });

    const filePath = path.join(tenantUploadDir, safeFilename);
    await fs.writeFile(filePath, file.buffer);

    const publicUrl = `/uploads/products/${tenantId}/${safeFilename}`;

    return {
      url: publicUrl,
      filename: safeFilename,
      size: file.size,
    };
  }
}
