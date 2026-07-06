import { ApiProperty } from '@nestjs/swagger';

export class ImportErrorDetail {
  @ApiProperty({ description: 'Số dòng lỗi', example: 5 })
  row: number;

  @ApiProperty({ description: 'Nội dung lỗi', example: 'Mã NV không hợp lệ' })
  message: string;
}

export class ImportResultDto {
  @ApiProperty({ description: 'Tổng số dòng xử lý', example: 100 })
  totalRows: number;

  @ApiProperty({ description: 'Số bản ghi tạo mới', example: 80 })
  created: number;

  @ApiProperty({ description: 'Số bản ghi cập nhật', example: 15 })
  updated: number;

  @ApiProperty({ description: 'Số bản ghi xung đột', example: 3 })
  conflicts: number;

  @ApiProperty({ description: 'Danh sách lỗi', type: [ImportErrorDetail] })
  errors: ImportErrorDetail[];
}
