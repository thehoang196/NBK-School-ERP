import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ManagementLevel, PositionTitle } from '../enums';

export class DepartmentMemberResponseDto {
  @ApiProperty({
    description: 'ID thành viên',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID giáo viên',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  teacherId: string;

  @ApiProperty({
    description: 'Họ tên giáo viên',
    example: 'Nguyễn Văn A',
  })
  fullName: string;

  @ApiProperty({
    description: 'Email giáo viên',
    example: 'nguyenvana@nbk.edu.vn',
  })
  email: string;

  @ApiProperty({
    description: 'ID tổ bộ môn',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  departmentId: string;

  @ApiProperty({
    description: 'Chức danh',
    enum: PositionTitle,
    example: PositionTitle.GVBM,
  })
  positionTitle: PositionTitle;

  @ApiPropertyOptional({
    description: 'Cấp bậc quản lý',
    enum: ManagementLevel,
    nullable: true,
    example: null,
  })
  managementLevel: ManagementLevel | null;
}
