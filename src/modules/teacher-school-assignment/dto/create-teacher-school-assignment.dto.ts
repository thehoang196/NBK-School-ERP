import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AssignmentRole } from '../enums/assignment-role.enum';

export class CreateTeacherSchoolAssignmentDto {
  @ApiProperty({
    description: 'ID giáo viên',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  teacherId: string;

  @ApiProperty({
    description: 'ID trường được phân công',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsNotEmpty()
  @IsUUID()
  schoolId: string;

  @ApiProperty({
    description:
      'Vai trò tại trường (thường là secondary vì primary được tạo tự động)',
    enum: AssignmentRole,
    example: AssignmentRole.SECONDARY,
  })
  @IsNotEmpty()
  @IsEnum(AssignmentRole)
  role: AssignmentRole;

  @ApiProperty({ description: 'Ngày bắt đầu hiệu lực', example: '2025-01-15' })
  @IsNotEmpty()
  @IsDateString()
  effectiveStartDate: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc hiệu lực',
    example: '2025-06-30',
  })
  @IsOptional()
  @IsDateString()
  effectiveEndDate?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú',
    example: 'Dạy tiếng Anh liên trường',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
