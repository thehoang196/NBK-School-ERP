import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GenerateWeeksDto {
  @ApiProperty({ description: 'ID học kỳ để sinh tuần tự động' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'semesterId phải là UUID hợp lệ' })
  semesterId: string;
}
