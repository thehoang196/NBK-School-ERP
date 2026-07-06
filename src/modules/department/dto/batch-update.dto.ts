import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { ManagementLevel, PositionTitle } from '../enums';

export enum BatchAction {
  ADD = 'add',
  REMOVE = 'remove',
  UPDATE_POSITION = 'updatePosition',
  UPDATE_LEVEL = 'updateLevel',
}

export class BatchOperationDto {
  @ApiProperty({
    description: 'Loại thao tác',
    enum: BatchAction,
    example: BatchAction.ADD,
  })
  @IsEnum(BatchAction, {
    message:
      'Action không hợp lệ. Giá trị cho phép: add, remove, updatePosition, updateLevel',
  })
  action: BatchAction;

  @ApiPropertyOptional({
    description: 'ID giáo viên (bắt buộc cho action "add")',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4')
  teacherId?: string;

  @ApiPropertyOptional({
    description:
      'ID thành viên (bắt buộc cho action "remove", "updatePosition", "updateLevel")',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('4')
  memberId?: string;

  @ApiPropertyOptional({
    description: 'Chức danh mới (bắt buộc cho action "updatePosition")',
    enum: PositionTitle,
    example: PositionTitle.GVCN,
  })
  @IsOptional()
  @ValidateIf((o) => o.positionTitle !== undefined)
  @IsEnum(PositionTitle, {
    message: 'Chức danh không hợp lệ. Giá trị cho phép: GVBM, GVCN, PCN',
  })
  positionTitle?: PositionTitle;

  @ApiPropertyOptional({
    description:
      'Cấp bậc quản lý (bắt buộc cho action "updateLevel", null để xóa)',
    enum: ManagementLevel,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (o) => o.managementLevel !== undefined && o.managementLevel !== null,
  )
  @IsEnum(ManagementLevel, {
    message:
      'Cấp bậc quản lý không hợp lệ. Giá trị cho phép: TO_TRUONG, TO_PHO, NHOM_TRUONG, GIAO_VU, QUAN_LY_PHONG, GIAM_THI',
  })
  managementLevel?: ManagementLevel | null;
}

export class BatchUpdateDto {
  @ApiProperty({
    description: 'Danh sách thao tác (tối đa 50)',
    type: [BatchOperationDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50, {
    message: 'Số lượng thao tác vượt quá giới hạn tối đa (50)',
  })
  @ValidateNested({ each: true })
  @Type(() => BatchOperationDto)
  operations: BatchOperationDto[];
}
