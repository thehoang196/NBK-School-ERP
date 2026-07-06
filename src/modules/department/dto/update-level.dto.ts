import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, ValidateIf } from 'class-validator';

import { ManagementLevel } from '../enums';

export class UpdateLevelDto {
  @ApiProperty({
    description: 'Cấp bậc quản lý (null để xóa cấp bậc)',
    enum: ManagementLevel,
    nullable: true,
    example: ManagementLevel.TO_TRUONG,
  })
  @ValidateIf((o) => o.managementLevel !== null)
  @IsEnum(ManagementLevel, {
    message:
      'Cấp bậc quản lý không hợp lệ. Giá trị cho phép: TO_TRUONG, TO_PHO, NHOM_TRUONG, GIAO_VU, QUAN_LY_PHONG, GIAM_THI',
  })
  managementLevel: ManagementLevel | null;
}
