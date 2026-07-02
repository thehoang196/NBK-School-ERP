import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, Matches } from 'class-validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateGradeDto {
  @ApiProperty({ description: 'ID trường', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId: string;

  @ApiProperty({ description: 'Tên khối', example: 'Khối 10' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Cấp lớp (1-12)', example: 10 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  level: number;
}
