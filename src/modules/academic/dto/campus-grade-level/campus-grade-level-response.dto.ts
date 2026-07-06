import { ApiProperty } from '@nestjs/swagger';
import { GradeLevel } from '../../enums';

export class CampusGradeLevelResponseDto {
  @ApiProperty({ description: 'ID bản ghi campus-grade-level' })
  id: string;

  @ApiProperty({ description: 'ID cơ sở (campus)' })
  campusId: string;

  @ApiProperty({ description: 'ID trường' })
  schoolId: string;

  @ApiProperty({ enum: GradeLevel, description: 'Cấp học' })
  gradeLevel: GradeLevel;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;
}
