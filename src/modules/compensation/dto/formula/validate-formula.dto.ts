import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class ValidateFormulaDto {
  @ApiProperty({ description: 'Biểu thức công thức cần validate', example: 'BASIC_SALARY * 1.5' })
  @IsString()
  @IsNotEmpty()
  expression: string;

  @ApiPropertyOptional({ description: 'ID trường (dùng để resolve pay components)' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
