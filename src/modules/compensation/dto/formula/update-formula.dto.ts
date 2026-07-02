import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateFormulaDto {
  @ApiProperty({ description: 'Biểu thức công thức mới' })
  @IsString()
  @IsNotEmpty()
  expression: string;

  @ApiPropertyOptional({ description: 'Ghi chú thay đổi' })
  @IsOptional()
  @IsString()
  changelog?: string;
}
