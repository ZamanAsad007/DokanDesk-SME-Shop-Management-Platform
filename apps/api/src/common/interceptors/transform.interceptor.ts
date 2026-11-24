import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '@dokandesk/shared';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = serializeBigInt(obj[key]);
    }
    return res;
  }
  return obj;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((res) => {
        const sanitized = serializeBigInt(res);

        // If already formatted with success property, pass through
        if (sanitized && typeof sanitized === 'object' && 'success' in sanitized) {
          return sanitized;
        }

        // If returned object has data and meta fields (e.g. paginated lists)
        if (sanitized && typeof sanitized === 'object' && 'data' in sanitized && 'meta' in sanitized) {
          return {
            success: true,
            data: sanitized.data,
            meta: sanitized.meta,
          };
        }

        return {
          success: true,
          data: sanitized,
        };
      }),
    );
  }
}
