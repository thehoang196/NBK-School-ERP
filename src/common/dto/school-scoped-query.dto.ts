import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from './pagination.dto';

/**
 * Base query DTO hỗ trợ lọc theo trường.
 *
 * - SUPER_ADMIN: truyền schoolId qua query param để chọn trường xem
 * - Các role khác: schoolId tự động từ JWT, query param bị bỏ qua
 */
export class SchoolScopedQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trường (SUPER_ADMIN dùng để chọn trường)',
    example: 'uuid-of-school',
  })
  @IsOptional()
  @IsUUID('4', { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;
}
