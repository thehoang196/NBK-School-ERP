import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

export class SubjectGradeItemDto {
  @ApiProperty({
    description: 'ID khối',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsNotEmpty({ message: 'ID khối không được để trống' })
  @IsUUID('4', { message: 'ID khối phải là UUID hợp lệ' })
  gradeId: string;

  @ApiProperty({
    description: 'Số tiết/tuần cho khối này',
    example: 4,
    minimum: 1,
    maximum: 20,
  })
  @IsNotEmpty({ message: 'Số tiết/tuần không được để trống' })
  @IsInt({ message: 'Số tiết/tuần phải là số nguyên' })
  @Min(1, { message: 'Số tiết/tuần không được nhỏ hơn 1' })
  @Max(20, { message: 'Số tiết/tuần không được vượt quá 20' })
  periodsPerWeek: number;
}

export class BulkUpsertSubjectGradeDto {
  @ApiProperty({
    description: 'Danh sách phân bổ số tiết theo khối',
    type: [SubjectGradeItemDto],
  })
  @IsArray({ message: 'Danh sách phải là mảng' })
  @ArrayMinSize(1, { message: 'Danh sách phải có ít nhất 1 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => SubjectGradeItemDto)
  grades: SubjectGradeItemDto[];
}
