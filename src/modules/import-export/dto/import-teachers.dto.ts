import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ConflictStrategy } from '../enums/conflict-strategy.enum';

export class ImportTeachersQueryDto {
  @ApiPropertyOptional({
    description: 'ID trường',
    format: 'uuid',
  })
  @IsUUID()
  schoolId: string;

  @ApiPropertyOptional({
    description:
      'Chiến lược xử lý xung đột: strict (fail nếu trùng), upsert (ghi đè toàn bộ), merge (chỉ update non-null)',
    enum: ConflictStrategy,
    default: ConflictStrategy.STRICT,
  })
  @IsEnum(ConflictStrategy)
  @IsOptional()
  conflictStrategy?: ConflictStrategy = ConflictStrategy.STRICT;
}
