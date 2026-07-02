import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSlotDto } from './create-slot.dto';

export class OverwriteSlotsDto {
  @ApiProperty({
    description: 'Danh sách ô TKB mới ghi đè',
    type: [CreateSlotDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSlotDto)
  slots: CreateSlotDto[];
}
