import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

import { PositionTitle } from '../enums';

export class UpdatePositionDto {
  @ApiProperty({
    description: 'Chức danh mới',
    enum: PositionTitle,
    example: PositionTitle.GVBM,
  })
  @IsNotEmpty()
  @IsEnum(PositionTitle, {
    message: 'Chức danh không hợp lệ. Giá trị cho phép: GVBM, GVCN, PCN',
  })
  positionTitle: PositionTitle;
}
