import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeMasterDto } from './create-employee-master.dto';

export class UpdateEmployeeMasterDto extends PartialType(
  CreateEmployeeMasterDto,
) {}
