import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class AssignTeacherSubjectsDto {
  @ApiProperty({
    description: 'Danh sách ID môn học cần gán cho giáo viên',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  subjectIds: string[];
}
