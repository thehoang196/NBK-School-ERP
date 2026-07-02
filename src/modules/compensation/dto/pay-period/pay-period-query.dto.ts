import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { PayPeriodStatus } from '../../enums';

export class PayPeriodQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ enum: PayPeriodStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(PayPeriodStatus)
  status?: PayPeriodStatus;
}
