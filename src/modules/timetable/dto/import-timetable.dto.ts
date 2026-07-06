import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsString,
  IsArray,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO cho request import TKB từ file Excel.
 * Validates: Requirements 1.2
 */
export class ImportTimetableDto {
  @ApiProperty({ description: 'ID học kỳ đích để import TKB', format: 'uuid' })
  @IsNotEmpty({ message: 'semesterId không được để trống' })
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId: string;
}

/**
 * DTO mô tả một lỗi cụ thể trong quá trình import.
 * Validates: Requirements 1.5, 1.7
 */
export class TimetableImportErrorDto {
  @ApiProperty({
    description: 'Số dòng trong file Excel (bắt đầu từ 2)',
    example: 5,
  })
  @IsInt()
  @Min(2)
  row: number;

  @ApiProperty({ description: 'Tên trường bị lỗi', example: 'Mã GV' })
  @IsString()
  field: string;

  @ApiProperty({
    description: 'Mô tả lỗi chi tiết',
    example: 'Không tìm thấy giáo viên với mã NV001',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Giá trị gốc trong file Excel',
    example: 'NV001',
  })
  @IsString()
  value: string;
}

/**
 * DTO kết quả import TKB, chứa tổng hợp và danh sách lỗi chi tiết.
 * Validates: Requirements 1.5, 1.7
 */
export class TimetableImportResultDto {
  @ApiProperty({
    description: 'Tổng số dòng dữ liệu (không tính header)',
    example: 150,
  })
  @IsInt()
  @Min(0)
  totalRows: number;

  @ApiProperty({ description: 'Số dòng import thành công', example: 145 })
  @IsInt()
  @Min(0)
  successCount: number;

  @ApiProperty({ description: 'Số dòng bị lỗi', example: 5 })
  @IsInt()
  @Min(0)
  errorCount: number;

  @ApiProperty({
    description: 'Danh sách lỗi chi tiết',
    type: [TimetableImportErrorDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimetableImportErrorDto)
  errors: TimetableImportErrorDto[];

  @ApiPropertyOptional({
    description: 'ID phiên bản TKB được tạo (null nếu không có dòng hợp lệ)',
    format: 'uuid',
    nullable: true,
  })
  versionId: string | null;

  @ApiPropertyOptional({
    description: 'Tên phiên bản TKB được tạo (null nếu không có dòng hợp lệ)',
    nullable: true,
  })
  versionName: string | null;
}
