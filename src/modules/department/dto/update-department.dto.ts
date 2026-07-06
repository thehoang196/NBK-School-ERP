import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { CreateDepartmentDto } from './create-department.dto';

export class UpdateDepartmentDto extends PartialType(
  OmitType(CreateDepartmentDto, ['schoolId', 'headTeacherId'] as const),
) {
  @ApiPropertyOptional({
    description: 'ID tổ trưởng (UUID của giáo viên, gửi null để xóa tổ trưởng)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4', { message: 'headTeacherId phải là UUID hợp lệ' })
  headTeacherId?: string | null;
}
