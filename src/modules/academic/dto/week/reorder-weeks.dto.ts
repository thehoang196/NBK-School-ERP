import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class ReorderWeeksDto {
  @ApiProperty({
    description: 'Danh sách ID tuần theo thứ tự mới',
    example: [
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ],
    type: [String],
  })
  @IsArray({ message: 'weekIds phải là một mảng' })
  @ArrayMinSize(1, { message: 'weekIds phải có ít nhất 1 phần tử' })
  @IsUUID('4', { each: true, message: 'Mỗi weekId phải là UUID hợp lệ' })
  weekIds: string[];
}
