import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsEmail,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Gender,
  TeacherType,
  TeacherStatus,
} from '../../../common/enums/status.enum';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UnavailableSlotDto {
  @ApiProperty({
    description: 'Ngày trong tuần (2=Thứ 2, 3=Thứ 3, ...7=Thứ 7, 8=Chủ nhật)',
    example: 2,
  })
  @IsInt({ message: 'dayOfWeek phải là số nguyên' })
  @Min(2, { message: 'dayOfWeek phải từ 2 đến 8' })
  @Max(8, { message: 'dayOfWeek phải từ 2 đến 8' })
  dayOfWeek: number;

  @ApiProperty({
    description: 'ID tiết học',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString({ message: 'periodId phải là chuỗi' })
  @Matches(UUID_REGEX, { message: 'periodId phải là UUID hợp lệ' })
  periodId: string;
}

export class CreateTeacherDto {
  @ApiProperty({
    description: 'ID trường',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'schoolId không được để trống' })
  @IsString({ message: 'schoolId phải là chuỗi' })
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId: string;

  @ApiProperty({ description: 'Mã nhân viên', example: 'GV001' })
  @IsNotEmpty({ message: 'Mã nhân viên không được để trống' })
  @IsString({ message: 'Mã nhân viên phải là chuỗi' })
  @MaxLength(20, { message: 'Mã nhân viên tối đa 20 ký tự' })
  employeeCode: string;

  @ApiPropertyOptional({ description: 'Số CCCD/CMND', example: '079090012345' })
  @IsOptional()
  @IsString({ message: 'citizenId phải là chuỗi' })
  @MaxLength(20, { message: 'CCCD/CMND tối đa 20 ký tự' })
  citizenId?: string;

  @ApiProperty({ description: 'Họ và tên', example: 'Nguyễn Văn A' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' })
  fullName: string;

  @ApiPropertyOptional({ description: 'Tên viết tắt', example: 'NVA' })
  @IsOptional()
  @IsString({ message: 'Tên viết tắt phải là chuỗi' })
  @MaxLength(50, { message: 'Tên viết tắt tối đa 50 ký tự' })
  shortName?: string;

  @ApiPropertyOptional({
    enum: Gender,
    description: 'Giới tính',
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Ngày sinh (ISO format)',
    example: '1990-01-15',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Ngày sinh phải đúng định dạng ngày (YYYY-MM-DD)' },
  )
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0912345678' })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Email',
    example: 'nguyenvana@school.edu.vn',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(100, { message: 'Email tối đa 100 ký tự' })
  email?: string;

  @ApiPropertyOptional({
    description: 'ID tổ bộ môn',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString({ message: 'departmentId phải là chuỗi' })
  @Matches(UUID_REGEX, { message: 'departmentId phải là UUID hợp lệ' })
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'ID khối (phụ trách)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString({ message: 'gradeId phải là chuỗi' })
  @Matches(UUID_REGEX, { message: 'gradeId phải là UUID hợp lệ' })
  gradeId?: string;

  @ApiPropertyOptional({ description: 'Chức danh nghề nghiệp', example: 'Giáo viên Toán' })
  @IsOptional()
  @IsString({ message: 'jobTitle phải là chuỗi' })
  @MaxLength(100, { message: 'Chức danh tối đa 100 ký tự' })
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Cấp quản lý', example: 'Tổ trưởng' })
  @IsOptional()
  @IsString({ message: 'managementLevel phải là chuỗi' })
  @MaxLength(50, { message: 'Cấp quản lý tối đa 50 ký tự' })
  managementLevel?: string;

  @ApiPropertyOptional({ description: 'Chức vụ', example: 'Tổ trưởng' })
  @IsOptional()
  @IsString({ message: 'Chức vụ phải là chuỗi' })
  @MaxLength(50, { message: 'Chức vụ tối đa 50 ký tự' })
  position?: string;

  @ApiPropertyOptional({
    enum: TeacherType,
    description: 'Loại giáo viên',
    example: TeacherType.FULL_TIME,
  })
  @IsOptional()
  @IsEnum(TeacherType, { message: 'Loại giáo viên không hợp lệ' })
  teacherType?: TeacherType;

  @ApiPropertyOptional({
    description: 'Số tiết tối đa/tuần',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsInt({ message: 'Số tiết tối đa/tuần phải là số nguyên' })
  @Min(0, { message: 'Số tiết tối đa/tuần phải >= 0' })
  @Max(50, { message: 'Số tiết tối đa/tuần phải <= 50' })
  maxPeriodsPerWeek?: number;

  @ApiPropertyOptional({
    description: 'Số tiết tối thiểu/tuần',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Số tiết tối thiểu/tuần phải là số nguyên' })
  @Min(0, { message: 'Số tiết tối thiểu/tuần phải >= 0' })
  @Max(50, { message: 'Số tiết tối thiểu/tuần phải <= 50' })
  minPeriodsPerWeek?: number;

  @ApiPropertyOptional({
    description: 'Số tiết tối đa/ngày',
    example: 6,
    default: 6,
  })
  @IsOptional()
  @IsInt({ message: 'Số tiết tối đa/ngày phải là số nguyên' })
  @Min(0, { message: 'Số tiết tối đa/ngày phải >= 0' })
  @Max(12, { message: 'Số tiết tối đa/ngày phải <= 12' })
  maxPeriodsPerDay?: number;

  @ApiPropertyOptional({
    description: 'Các slot không dạy được',
    type: [UnavailableSlotDto],
    example: [
      { dayOfWeek: 2, periodId: '550e8400-e29b-41d4-a716-446655440000' },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'unavailableSlots phải là mảng' })
  @ValidateNested({
    each: true,
    message: 'Mỗi phần tử trong unavailableSlots phải hợp lệ',
  })
  @Type(() => UnavailableSlotDto)
  unavailableSlots?: UnavailableSlotDto[];

  @ApiPropertyOptional({
    enum: TeacherStatus,
    description: 'Trạng thái',
    default: TeacherStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(TeacherStatus, { message: 'Trạng thái không hợp lệ' })
  status?: TeacherStatus;
}
