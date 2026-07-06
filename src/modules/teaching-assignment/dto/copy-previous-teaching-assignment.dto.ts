import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CopyPreviousTeachingAssignmentDto {
  @ApiProperty({ description: 'ID học kỳ nguồn (học kỳ trước)' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'sourceSemesterId phải là UUID hợp lệ' })
  sourceSemesterId: string;

  @ApiProperty({ description: 'ID học kỳ đích (học kỳ hiện tại)' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'targetSemesterId phải là UUID hợp lệ' })
  targetSemesterId: string;
}
