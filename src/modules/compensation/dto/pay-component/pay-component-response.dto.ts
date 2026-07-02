import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayComponentType } from '../../enums';
import { EntityStatus } from '../../../../common/enums/status.enum';

export class PayComponentResponseDto {
  @ApiProperty({ description: 'ID' })
  id: string;

  @ApiProperty({ description: 'ID trường' })
  schoolId: string;

  @ApiProperty({ description: 'Mã thành phần lương' })
  code: string;

  @ApiProperty({ description: 'Tên thành phần lương' })
  name: string;

  @ApiProperty({ description: 'Loại', enum: PayComponentType })
  type: PayComponentType;

  @ApiProperty({ description: 'Thứ tự hiển thị' })
  sortOrder: number;

  @ApiProperty({ description: 'Chịu thuế' })
  isTaxable: boolean;

  @ApiProperty({ description: 'Tính BHXH' })
  isInsuranceApplicable: boolean;

  @ApiProperty({ description: 'Bắt buộc theo pháp luật' })
  isStatutory: boolean;

  @ApiProperty({ description: 'Trạng thái', enum: EntityStatus })
  status: EntityStatus;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;
}
