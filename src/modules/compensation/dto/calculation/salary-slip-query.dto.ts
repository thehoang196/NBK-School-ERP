import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { SalarySlipStatus } from '../../enums';

export class SalarySlipQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo kỳ lương' })
  @IsOptional()
  @IsUUID()
  payPeriodId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo giáo viên' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    enum: SalarySlipStatus,
    description: 'Lọc theo trạng thái',
  })
  @IsOptional()
  @IsEnum(SalarySlipStatus)
  status?: SalarySlipStatus;
}
