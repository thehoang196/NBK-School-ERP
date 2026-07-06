import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

export class SourceDataItemDto {
  @ApiProperty({ description: 'Mã nhân viên', example: 'NV001' })
  @IsString()
  @IsNotEmpty()
  employeeCode: string;

  [fieldName: string]: string | number | null;
}

export class TriggerReconciliationDto {
  @ApiProperty({ description: 'ID trường học', example: 'uuid-school-id' })
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({
    description: 'Module nguồn dữ liệu',
    example: 'teaching-assignment',
  })
  @IsString()
  @IsNotEmpty()
  sourceModule: string;

  @ApiProperty({
    description: 'Dữ liệu nguồn cần đối chiếu',
    type: [SourceDataItemDto],
    example: [
      {
        employeeCode: 'NV001',
        fullName: 'Nguyen Van A',
        departmentName: 'Toán',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SourceDataItemDto)
  sourceData: SourceDataItemDto[];
}
