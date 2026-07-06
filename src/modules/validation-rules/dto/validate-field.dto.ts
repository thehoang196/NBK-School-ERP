import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID } from 'class-validator';
import { ValidationEntityTarget } from '../entities/validation-rule.entity';

export class ValidateFieldDto {
  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Entity target', enum: ValidationEntityTarget })
  @IsEnum(ValidationEntityTarget)
  entityTarget: ValidationEntityTarget;

  @ApiProperty({ description: 'Tên field cần validate' })
  @IsString()
  fieldName: string;

  @ApiProperty({ description: 'Giá trị cần validate' })
  value: unknown;
}
