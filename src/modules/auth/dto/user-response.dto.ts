import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/role.enum';

export class UserResponseDto {
  @ApiProperty({ description: 'ID người dùng (UUID)' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên người dùng' })
  name: string;

  @ApiProperty({ example: 'user@stms.vn', description: 'Email đăng nhập' })
  email: string;

  @ApiProperty({ enum: UserRole, description: 'Vai trò' })
  role: UserRole;

  @ApiPropertyOptional({ description: 'ID trường học' })
  schoolId: string | null;

  @ApiPropertyOptional({ description: 'ID giáo viên liên kết' })
  teacherId: string | null;

  @ApiProperty({ description: 'Trạng thái hoạt động' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Lần đăng nhập cuối' })
  lastLoginAt: Date | null;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;
}
