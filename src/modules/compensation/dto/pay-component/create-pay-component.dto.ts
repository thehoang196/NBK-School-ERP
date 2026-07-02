import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsInt, Min, Matches, IsUUID } from 'class-validator';
import { PayComponentType } from '../../enums';

export class CreatePayComponentDto {
  @ApiProperty({ description: 'ID trường', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({ description: 'Mã thành phần lương (chỉ chữ hoa, số, gạch dưới)', example: 'BASIC_SALARY' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Code phải bắt đầu bằng chữ hoa và chỉ chứa chữ hoa, số, gạch dưới',
  })
  code: string;

  @ApiProperty({ description: 'Tên thành phần lương', example: 'Lương cơ bản' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Loại: earning hoặc deduction', enum: PayComponentType })
  @IsEnum(PayComponentType)
  type: PayComponentType;

  @ApiPropertyOptional({ description: 'Thứ tự hiển thị', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Chịu thuế', default: false })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional({ description: 'Tính BHXH', default: false })
  @IsOptional()
  @IsBoolean()
  isInsuranceApplicable?: boolean;

  @ApiPropertyOptional({ description: 'Bắt buộc theo pháp luật', default: false })
  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean;
}
