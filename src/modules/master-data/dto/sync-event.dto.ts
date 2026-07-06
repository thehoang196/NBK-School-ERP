import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class MasterDataChangedEventDto {
  @ApiProperty({ description: 'School ID' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Mã nhân viên' })
  @IsString()
  employeeCode: string;

  @ApiProperty({ description: 'Tên trường thay đổi' })
  @IsString()
  fieldName: string;

  @ApiPropertyOptional({ description: 'Giá trị cũ' })
  @IsOptional()
  @IsString()
  oldValue: string | null;

  @ApiPropertyOptional({ description: 'Giá trị mới' })
  @IsOptional()
  @IsString()
  newValue: string | null;

  @ApiProperty({ description: 'Người thay đổi' })
  @IsString()
  changedBy: string;

  @ApiProperty({ description: 'Thời điểm thay đổi' })
  @IsDateString()
  timestamp: string;
}

export class ModuleDataChangedEventDto {
  @ApiProperty({ description: 'Module nguồn' })
  @IsString()
  sourceModule: string;

  @ApiProperty({ description: 'School ID' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Mã nhân viên' })
  @IsString()
  employeeCode: string;

  @ApiProperty({ description: 'Tên trường thay đổi' })
  @IsString()
  fieldName: string;

  @ApiPropertyOptional({ description: 'Giá trị mới' })
  @IsOptional()
  @IsString()
  newValue: string | null;

  @ApiProperty({ description: 'Thời điểm thay đổi' })
  @IsDateString()
  timestamp: string;
}
