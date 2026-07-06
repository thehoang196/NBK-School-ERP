import { PartialType } from '@nestjs/swagger';
import { CreatePeriodDefinitionDto } from './create-period-definition.dto';

export class UpdatePeriodDefinitionDto extends PartialType(
  CreatePeriodDefinitionDto,
) {}
