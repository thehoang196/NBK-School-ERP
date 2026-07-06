import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    description: 'ID của giáo viên cần thêm vào tổ bộ môn',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID('4')
  teacherId: string;
}
