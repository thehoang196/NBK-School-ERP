import { ApiProperty } from '@nestjs/swagger';

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export class ImportResultDto {
  @ApiProperty({ description: 'Tổng số dòng trong file' })
  totalRows: number;

  @ApiProperty({ description: 'Số dòng import thành công' })
  successCount: number;

  @ApiProperty({ description: 'Số dòng lỗi' })
  errorCount: number;

  @ApiProperty({
    description: 'Chi tiết lỗi từng dòng',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        row: { type: 'number' },
        field: { type: 'string' },
        message: { type: 'string' },
        value: { type: 'string' },
      },
    },
  })
  errors: ImportError[];
}
