import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class SwitchContextDto {
  @ApiProperty({
    description: 'UUID của trường cần chuyển đổi ngữ cảnh',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'Định dạng schoolId không hợp lệ. Vui lòng cung cấp UUID đúng' })
  @IsNotEmpty({ message: 'schoolId không được để trống' })
  schoolId: string;
}
