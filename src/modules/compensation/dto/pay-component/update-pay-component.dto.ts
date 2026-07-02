import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, Min, IsEnum, Matches } from 'class-validator';
import { PayComponentType } from '../../enums';
import { EntityStatus } from '../../../../common/enums/status.enum';

export class UpdatePayComponentDto {
  @ApiPropertyOptional({ description: 'Mã thành phần lương', example: 'BASIC_SALARY' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Code phải bắt đầu bằng chữ hoa và chỉ chứa chữ hoa, số, gạch dưới',
  })
  code?: string;

  @ApiPropertyOptional({ description: 'Tên thành phần lương', example: 'Lương cơ bản' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Loại: earning hoặc deduction', enum: PayComponentType })
  @IsOptional()
  @IsEnum(PayComponentType)
  type?: PayComponentType;

  @ApiPropertyOptional({ description: 'Thứ tự hiển thị' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Chịu thuế' })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional({ description: 'Tính BHXH' })
  @IsOptional()
  @IsBoolean()
  isInsuranceApplicable?: boolean;

  @ApiPropertyOptional({ description: 'Bắt buộc theo pháp luật' })
  @IsOptional()
  @IsBoolean()
  isStatutory?: boolean;

  @ApiPropertyOptional({ description: 'Trạng thái', enum: EntityStatus })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}
