import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class OverrideConflictDto {
  @ApiProperty({ description: 'ID slot cần ghi đè xung đột', format: 'uuid' })
  @IsNotEmpty({ message: 'slotId không được để trống' })
  @IsUUID('4', { message: 'slotId phải là UUID hợp lệ' })
  slotId: string;

  @ApiProperty({
    description: 'Danh sách ID conflict log cần ghi đè',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray({ message: 'conflictLogIds phải là mảng' })
  @IsUUID('4', { each: true, message: 'Mỗi conflictLogId phải là UUID hợp lệ' })
  conflictLogIds: string[];

  @ApiProperty({
    description: 'Lý do ghi đè xung đột (tối thiểu 10 ký tự)',
    minLength: 10,
    example: 'Giáo viên đã xác nhận có thể dạy liên tiếp',
  })
  @IsString({ message: 'reason phải là chuỗi ký tự' })
  @MinLength(10, { message: 'Lý do ghi đè phải có ít nhất 10 ký tự' })
  reason: string;
}
