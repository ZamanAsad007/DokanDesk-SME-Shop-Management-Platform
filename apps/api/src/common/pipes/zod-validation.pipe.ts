import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { ApiErrorCode } from '@dokandesk/shared';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.reduce<Record<string, string>>((acc, curr) => {
          const field = curr.path.join('.') || 'root';
          acc[field] = curr.message;
          return acc;
        }, {});

        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Input validation failed',
          details,
        });
      }
      throw error;
    }
  }
}
