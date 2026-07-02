import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateTeachingAssignmentDto } from './create-teaching-assignment.dto';

export class BulkCreateTeachingAssignmentDto {
  @ApiProperty({ type: [CreateTeachingAssignmentDto], description: 'Danh sách phân công' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTeachingAssignmentDto)
  assignments: CreateTeachingAssignmentDto[];
}
