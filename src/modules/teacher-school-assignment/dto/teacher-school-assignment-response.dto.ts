import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentRole } from '../enums/assignment-role.enum';
import { AssignmentStatus } from '../enums/assignment-status.enum';

export class TeacherSchoolAssignmentResponseDto {
  @ApiProperty({
    description: 'ID bản ghi phân công',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID giáo viên',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  teacherId: string;

  @ApiProperty({
    description: 'ID trường',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  schoolId: string;

  @ApiProperty({
    description: 'Vai trò tại trường',
    enum: AssignmentRole,
    example: AssignmentRole.SECONDARY,
  })
  role: AssignmentRole;

  @ApiProperty({
    description: 'Trạng thái phân công',
    enum: AssignmentStatus,
    example: AssignmentStatus.ACTIVE,
  })
  status: AssignmentStatus;

  @ApiProperty({ description: 'Ngày bắt đầu hiệu lực', example: '2025-01-15' })
  effectiveStartDate: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc hiệu lực',
    nullable: true,
    example: '2025-06-30',
  })
  effectiveEndDate: string | null;

  @ApiPropertyOptional({
    description: 'Ghi chú',
    nullable: true,
    example: 'Dạy tiếng Anh liên trường',
  })
  note: string | null;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;
}
