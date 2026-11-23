import { describe, it, expect, vi } from 'vitest';
import { HttpStatus, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { ApiErrorCode } from '@dokandesk/shared';

describe('HttpExceptionFilter', () => {
  it('formats NotFoundException into standard API error response', () => {
    const filter = new HttpExceptionFilter();
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    const hostMock: any = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: statusMock,
        }),
      }),
    };

    filter.catch(new NotFoundException('Product not found'), hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product not found',
      },
    });
  });

  it('preserves custom error code and details if provided in HttpException', () => {
    const filter = new HttpExceptionFilter();
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    const hostMock: any = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: statusMock,
        }),
      }),
    };

    const customException = new BadRequestException({
      code: ApiErrorCode.INSUFFICIENT_STOCK,
      message: 'Stock too low',
      details: { available: 0, requested: 2 },
    });

    filter.catch(customException, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ApiErrorCode.INSUFFICIENT_STOCK,
        message: 'Stock too low',
        details: { available: 0, requested: 2 },
      },
    });
  });
});
