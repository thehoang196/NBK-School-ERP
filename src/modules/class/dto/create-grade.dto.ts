import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, IsIn, MaxLength } from 'class-validator';

export class CreateGradeDto {
  @ApiProperty({
    description: 'Tên khối',
    example: 'Khối 10',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Tên khối không được để trống' })
  @IsString({ message: 'Tên khối phải là chuỗi ký tự' })
  @MaxLength(50, { message: 'Tên khối không được vượt quá 50 ký tự' })
  name: string;

  @ApiProperty({
    description: 'Cấp lớp (khối 10, 11, hoặc 12)',
    example: 10,
    enum: [10, 11, 12],
  })
  @IsNotEmpty({ message: 'Cấp lớp không được để trống' })
  @IsInt({ message: 'Cấp lớp phải là số nguyên' })
  @IsIn([10, 11, 12], { message: 'Cấp lớp phải là 10, 11 hoặc 12' })
  level: number;
}
