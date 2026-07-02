import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateFormulaDto {
  @ApiProperty({ description: 'ID thành phần lương' })
  @IsUUID()
  @IsNotEmpty()
  payComponentId: string;

  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({ description: 'Biểu thức công thức', example: 'BASIC_SALARY * WORKING_DAYS / STANDARD_DAYS' })
  @IsString()
  @IsNotEmpty()
  expression: string;

  @ApiPropertyOptional({ description: 'Ghi chú thay đổi' })
  @IsOptional()
  @IsString()
  changelog?: string;
}
