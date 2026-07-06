import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsUUID,
  IsEnum,
  IsMilitaryTime,
  Min,
  MaxLength,
} from 'class-validator';
import { GradeLevel } from '../../enums';

export class CreateSessionDto {
  @ApiProperty({
    description: 'ID cơ sở (campus)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty({ message: 'campusId không được để trống' })
  @IsUUID('4', { message: 'campusId phải là UUID hợp lệ' })
  campusId: string;

  @ApiProperty({
    description: 'Cấp học',
    enum: GradeLevel,
    example: GradeLevel.PRIMARY,
  })
  @IsNotEmpty({ message: 'Cấp học không được để trống' })
  @IsEnum(GradeLevel, {
    message:
      'gradeLevel phải là giá trị hợp lệ: primary, middle_school, high_school',
  })
  gradeLevel: GradeLevel;

  @ApiProperty({
    description: 'Tên ca học',
    example: 'Sáng',
  })
  @IsNotEmpty({ message: 'Tên ca học không được để trống' })
  @IsString({ message: 'Tên ca học phải là chuỗi ký tự' })
  @MaxLength(50, { message: 'Tên ca học không được vượt quá 50 ký tự' })
  name: string;

  @ApiProperty({
    description: 'Giờ bắt đầu (định dạng HH:mm)',
    example: '07:00',
  })
  @IsNotEmpty({ message: 'Giờ bắt đầu không được để trống' })
  @IsMilitaryTime({ message: 'Giờ bắt đầu phải đúng định dạng HH:mm' })
  startTime: string;

  @ApiProperty({
    description: 'Giờ kết thúc (định dạng HH:mm)',
    example: '11:30',
  })
  @IsNotEmpty({ message: 'Giờ kết thúc không được để trống' })
  @IsMilitaryTime({ message: 'Giờ kết thúc phải đúng định dạng HH:mm' })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Thứ tự sắp xếp phải là số nguyên' })
  @Min(0, { message: 'Thứ tự sắp xếp phải lớn hơn hoặc bằng 0' })
  sortOrder?: number;
}
