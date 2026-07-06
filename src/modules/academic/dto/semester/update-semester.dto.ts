import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { CreateSemesterDto } from './create-semester.dto';

export class UpdateSemesterDto extends PartialType(
  OmitType(CreateSemesterDto, ['academicYearId'] as const),
) {}
