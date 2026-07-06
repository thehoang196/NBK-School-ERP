import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherType, TeacherStatus } from '../../../common/enums/status.enum';
import {
  AssignmentRole,
  AssignmentStatus,
} from '../../teacher-school-assignment/enums';

export class SchoolAssignmentSummaryDto {
  @ApiProperty({ description: 'ID của assignment' })
  id: string;

  @ApiProperty({ description: 'ID trường' })
  schoolId: string;

  @ApiProperty({ description: 'Tên trường' })
  schoolName: string;

  @ApiProperty({ description: 'Mã trường' })
  schoolCode: string;

  @ApiProperty({
    enum: AssignmentRole,
    description: 'Vai trò (primary/secondary)',
  })
  role: AssignmentRole;

  @ApiProperty({ enum: AssignmentStatus, description: 'Trạng thái' })
  status: AssignmentStatus;

  @ApiProperty({ description: 'Ngày bắt đầu hiệu lực' })
  effectiveStartDate: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc hiệu lực' })
  effectiveEndDate: string | null;
}

export class OrgTeacherResponseDto {
  @ApiProperty({ description: 'ID giáo viên' })
  id: string;

  @ApiProperty({ description: 'Mã nhân viên' })
  employeeCode: string;

  @ApiProperty({ description: 'Họ tên đầy đủ' })
  fullName: string;

  @ApiPropertyOptional({ description: 'Tên viết tắt' })
  shortName: string | null;

  @ApiProperty({ enum: TeacherType, description: 'Loại giáo viên' })
  teacherType: TeacherType;

  @ApiProperty({ enum: TeacherStatus, description: 'Trạng thái' })
  status: TeacherStatus;

  @ApiProperty({ description: 'ID trường chính (từ teacher.schoolId)' })
  primarySchoolId: string;

  @ApiPropertyOptional({ description: 'Tên trường chính' })
  primarySchoolName: string | null;

  @ApiPropertyOptional({ description: 'ID tổ bộ môn' })
  departmentId: string | null;

  @ApiPropertyOptional({ description: 'Tên tổ bộ môn' })
  departmentName: string | null;

  @ApiProperty({ description: 'Có phân công cross-school hay không' })
  hasCrossSchool: boolean;

  @ApiProperty({ description: 'Số trường đang dạy (bao gồm primary)' })
  schoolCount: number;

  @ApiProperty({
    description: 'Danh sách trường đang phân công',
    type: [SchoolAssignmentSummaryDto],
  })
  assignments: SchoolAssignmentSummaryDto[];
}

export class OrgTeacherDetailDto extends OrgTeacherResponseDto {
  @ApiPropertyOptional({ description: 'Email' })
  email: string | null;

  @ApiPropertyOptional({ description: 'Số điện thoại' })
  phone: string | null;

  @ApiPropertyOptional({ description: 'Chức vụ' })
  jobTitle: string | null;

  @ApiProperty({ description: 'Số tiết tối đa/tuần' })
  maxPeriodsPerWeek: number;

  @ApiProperty({ description: 'Số tiết tối thiểu/tuần' })
  minPeriodsPerWeek: number;

  @ApiProperty({ description: 'Số tiết tối đa/ngày' })
  maxPeriodsPerDay: number;

  @ApiProperty({
    description: 'Lịch sử phân công đầy đủ (bao gồm inactive)',
    type: [SchoolAssignmentSummaryDto],
  })
  assignmentHistory: SchoolAssignmentSummaryDto[];

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;
}
