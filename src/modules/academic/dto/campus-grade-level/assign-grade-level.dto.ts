import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, Matches } from 'class-validator';
import { GradeLevel } from '../../enums';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AssignGradeLevelDto {
  @ApiProperty({ description: 'ID cơ sở (campus)' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'campusId phải là UUID hợp lệ' })
  campusId: string;

  @ApiProperty({
    enum: GradeLevel,
    description: 'Cấp học',
    example: GradeLevel.PRIMARY,
  })
  @IsNotEmpty()
  @IsEnum(GradeLevel, {
    message: `gradeLevel phải là một trong các giá trị: ${Object.values(GradeLevel).join(', ')}`,
  })
  gradeLevel: GradeLevel;
}
