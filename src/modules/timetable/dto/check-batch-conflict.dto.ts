import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CheckSlotConflictDto } from './check-slot-conflict.dto';

export class CheckBatchConflictDto {
  @ApiProperty({ description: 'ID phiên bản TKB', format: 'uuid' })
  @IsNotEmpty({ message: 'versionId không được để trống' })
  @IsUUID('4', { message: 'versionId phải là UUID hợp lệ' })
  versionId: string;

  @ApiProperty({
    description: 'Danh sách slots cần kiểm tra xung đột',
    type: [CheckSlotConflictDto],
  })
  @IsArray({ message: 'slots phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => CheckSlotConflictDto)
  slots: CheckSlotConflictDto[];
}
