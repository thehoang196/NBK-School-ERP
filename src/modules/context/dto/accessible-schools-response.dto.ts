import { ApiProperty } from '@nestjs/swagger';

export class AccessibleSchoolResponseItemDto {
  @ApiProperty({
    description: 'UUID của trường',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Mã trường',
    example: 'TH01',
  })
  code: string;

  @ApiProperty({
    description: 'Tên trường',
    example: 'Trường THPT Nguyễn Bỉnh Khiêm',
  })
  name: string;

  @ApiProperty({
    description: 'Cấp bậc trong hệ thống phân cấp tổ chức',
    enum: ['holding', 'company', 'school'],
    example: 'school',
  })
  hierarchyLevel: 'holding' | 'company' | 'school';

  @ApiProperty({
    description: 'Người dùng có thể chuyển đổi sang trường này hay không',
    example: true,
  })
  canSwitch: boolean;
}

export class AccessibleSchoolsResponseDto {
  @ApiProperty({
    description: 'Danh sách các trường mà người dùng có quyền truy cập',
    type: [AccessibleSchoolResponseItemDto],
  })
  schools: AccessibleSchoolResponseItemDto[];

  @ApiProperty({
    description: 'Người dùng có thể chuyển đổi ngữ cảnh hay không (có 2+ trường)',
    example: true,
  })
  canSwitch: boolean;
}
