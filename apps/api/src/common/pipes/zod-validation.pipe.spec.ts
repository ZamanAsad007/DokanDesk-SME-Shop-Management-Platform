import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from './zod-validation.pipe.js';
import { ApiErrorCode } from '@dokandesk/shared';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().min(18),
  });

  const pipe = new ZodValidationPipe(schema);

  it('passes valid input through unchanged', () => {
    const input = { name: 'Rahim', age: 25 };
    expect(pipe.transform(input)).toEqual(input);
  });

  it('throws BadRequestException with VALIDATION_ERROR code and field breakdown', () => {
    const input = { name: 'A', age: 15 };
    try {
      pipe.transform(input);
      expect.fail('Should have thrown BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as any;
      expect(response.code).toBe(ApiErrorCode.VALIDATION_ERROR);
      expect(response.details).toBeDefined();
      expect(response.details['name']).toBeDefined();
      expect(response.details['age']).toBeDefined();
    }
  });
});
