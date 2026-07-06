import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class GenerateWeeksDto {
  @ApiProperty({
    description: 'ID học kỳ để sinh tuần tự động',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'semesterId không được để trống' })
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId: string;
}
