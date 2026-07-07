import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/role.enum';

export class CurrentContextResponseDto {
  @ApiPropertyOptional({
    description: 'UUID của trường đang hoạt động, null nếu chưa chọn ngữ cảnh',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    nullable: true,
  })
  activeSchoolId: string | null;

  @ApiPropertyOptional({
    description: 'Tên trường đang hoạt động, null nếu chưa chọn ngữ cảnh',
    example: 'Trường THPT Nguyễn Bỉnh Khiêm',
    nullable: true,
  })
  activeSchoolName: string | null;

  @ApiPropertyOptional({
    description: 'Mã trường đang hoạt động, null nếu chưa chọn ngữ cảnh',
    example: 'TH01',
    nullable: true,
  })
  activeSchoolCode: string | null;

  @ApiProperty({
    description: 'Chế độ Global View có đang bật hay không (chỉ SUPER_ADMIN)',
    example: false,
    default: false,
  })
  globalView: boolean;

  @ApiProperty({
    description: 'Vai trò hệ thống của người dùng',
    enum: UserRole,
    example: UserRole.SCHOOL_ADMIN,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Người dùng có thể chuyển đổi ngữ cảnh hay không (có 2+ trường)',
    example: true,
  })
  canSwitch: boolean;

  @ApiProperty({
    description: 'Cần chọn ngữ cảnh trước khi truy cập module hay không',
    example: false,
  })
  contextRequired: boolean;
}
