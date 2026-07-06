import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsEnum,
  IsMilitaryTime,
  Min,
} from 'class-validator';
import { GradeLevel } from '../../enums';

export class CreatePeriodDefinitionDto {
  @ApiProperty({
    description: 'ID ca học',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty({ message: 'sessionId không được để trống' })
  @IsUUID('4', { message: 'sessionId phải là UUID hợp lệ' })
  sessionId: string;

  @ApiProperty({
    description: 'Cấp học',
    enum: GradeLevel,
    example: GradeLevel.PRIMARY,
  })
  @IsOptional()
  @IsEnum(GradeLevel, {
    message:
      'gradeLevel phải là giá trị hợp lệ: primary, middle_school, high_school',
  })
  gradeLevel?: GradeLevel;

  @ApiProperty({
    description: 'Số thứ tự tiết trong ca học',
    example: 1,
  })
  @IsNotEmpty({ message: 'periodNumber không được để trống' })
  @IsInt({ message: 'periodNumber phải là số nguyên' })
  @Min(1, { message: 'periodNumber phải lớn hơn hoặc bằng 1' })
  periodNumber: number;

  @ApiProperty({
    description: 'Giờ bắt đầu tiết học (định dạng HH:mm)',
    example: '07:00',
  })
  @IsNotEmpty({ message: 'startTime không được để trống' })
  @IsMilitaryTime({ message: 'startTime phải đúng định dạng HH:mm' })
  startTime: string;

  @ApiProperty({
    description: 'Giờ kết thúc tiết học (định dạng HH:mm)',
    example: '07:45',
  })
  @IsNotEmpty({ message: 'endTime không được để trống' })
  @IsMilitaryTime({ message: 'endTime phải đúng định dạng HH:mm' })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Có phải giờ ra chơi không',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isBreak phải là giá trị boolean' })
  isBreak?: boolean;

  @ApiPropertyOptional({
    description: 'Là tiết phụ/tiết tăng thêm',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isExtra phải là giá trị boolean' })
  isExtra?: boolean;
}
