import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên người dùng' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'user@stms.vn', description: 'Email đăng nhập' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Mật khẩu (tối thiểu 6 ký tự)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.TEACHER,
    description: 'Vai trò',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    description: 'ID trường học (bắt buộc nếu role không phải super_admin)',
  })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'ID giáo viên liên kết' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
