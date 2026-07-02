import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsEmail,
  IsArray,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Gender, TeacherType, TeacherStatus } from '../../../common/enums/status.enum';
import { UnavailableSlot } from '../entities/teacher.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UpdateTeacherDto {
  @ApiPropertyOptional({ description: 'Mã nhân viên', example: 'GV001' })
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiPropertyOptional({ description: 'Số CCCD', example: '001234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  citizenId?: string;

  @ApiPropertyOptional({ description: 'Họ tên đầy đủ', example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Tên gọi (hiển thị trên TKB)', example: 'A' })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Giới tính' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Ngày sinh', example: '1990-01-15' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email', example: 'teacher@school.edu.vn' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'ID khối (grade)' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'gradeId phải là UUID hợp lệ' })
  gradeId?: string;

  @ApiPropertyOptional({ description: 'ID tổ bộ môn' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'departmentId phải là UUID hợp lệ' })
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Chức danh', example: 'Giáo viên chính' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Cấp bậc quản lý', example: 'Tổ trưởng' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  managementLevel?: string;

  @ApiPropertyOptional({ description: 'Chức vụ', example: 'Tổ trưởng' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ enum: TeacherType })
  @IsOptional()
  @IsEnum(TeacherType)
  teacherType?: TeacherType;

  @ApiPropertyOptional({ description: 'Số tiết tối đa/tuần' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  maxPeriodsPerWeek?: number;

  @ApiPropertyOptional({ description: 'Số tiết tối thiểu/tuần' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minPeriodsPerWeek?: number;

  @ApiPropertyOptional({ description: 'Số tiết tối đa/ngày' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  maxPeriodsPerDay?: number;

  @ApiPropertyOptional({ description: 'Các tiết không dạy được' })
  @IsOptional()
  @IsArray()
  unavailableSlots?: UnavailableSlot[];

  @ApiPropertyOptional({ enum: TeacherStatus })
  @IsOptional()
  @IsEnum(TeacherStatus)
  status?: TeacherStatus;
}
