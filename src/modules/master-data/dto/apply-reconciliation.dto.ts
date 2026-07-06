import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class ApplyReconciliationDto {
  @ApiProperty({
    description: 'Danh sách các trường được chấp nhận cập nhật',
    type: [String],
    example: ['fullName', 'departmentName', 'jobTitle'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  acceptedFields: string[];
}
