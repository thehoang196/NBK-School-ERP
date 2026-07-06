import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the response already has success property, pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        // Handle paginated responses: { data: T[], meta: PaginationMeta }
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'meta' in data
        ) {
          const paginatedData = data as { data: T; meta: PaginationMeta };
          return {
            success: true,
            data: paginatedData.data,
            message: 'Success',
            meta: paginatedData.meta,
          };
        }

        return {
          success: true,
          data,
          message: 'Success',
        };
      }),
    );
  }
}
