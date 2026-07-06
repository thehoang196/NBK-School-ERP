import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  Matches,
  IsUUID,
} from 'class-validator';
import { VariableDataType, VariableScope } from '../../enums';

export class CreateVariableDto {
  @ApiProperty({
    description: 'Mã biến (chỉ chữ hoa, số, gạch dưới)',
    example: 'LESSON_RATE',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'Code phải bắt đầu bằng chữ hoa và chỉ chứa chữ hoa, số, gạch dưới',
  })
  code: string;

  @ApiProperty({ description: 'Tên hiển thị', example: 'Đơn giá tiết dạy' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Kiểu dữ liệu', enum: VariableDataType })
  @IsEnum(VariableDataType)
  dataType: VariableDataType;

  @ApiPropertyOptional({ description: 'Giá trị mặc định', example: '150000' })
  @IsOptional()
  @IsString()
  defaultValue?: string | null;

  @ApiProperty({ description: 'Phạm vi áp dụng', enum: VariableScope })
  @IsEnum(VariableScope)
  scope: VariableScope;

  @ApiPropertyOptional({
    description: 'ID phạm vi (school_id cho SCHOOL scope)',
  })
  @IsOptional()
  @IsUUID()
  scopeId?: string | null;

  @ApiPropertyOptional({
    description: 'Cấp học (cho SCHOOL_LEVEL scope)',
    example: 'THPT',
  })
  @IsOptional()
  @IsString()
  scopeLevel?: string | null;

  @ApiPropertyOptional({ description: 'Mô tả biến' })
  @IsOptional()
  @IsString()
  description?: string | null;
}
