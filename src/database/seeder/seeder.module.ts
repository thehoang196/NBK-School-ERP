import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeederService } from './seeder.service';

// Entities
import { UserEntity } from '../../modules/auth/entities/user.entity';
import { SchoolEntity } from '../../modules/school/entities/school.entity';
import { CampusEntity } from '../../modules/school/entities/campus.entity';
import { AcademicYearEntity } from '../../modules/academic/entities/academic-year.entity';
import { SemesterEntity } from '../../modules/academic/entities/semester.entity';
import { WeekEntity } from '../../modules/academic/entities/week.entity';
import { SessionEntity } from '../../modules/academic/entities/session.entity';
import { PeriodDefinitionEntity } from '../../modules/academic/entities/period-definition.entity';
import { CampusGradeLevelEntity } from '../../modules/academic/entities/campus-grade-level.entity';
import { GradeEntity } from '../../modules/class/entities/grade.entity';
import { ClassEntity } from '../../modules/class/entities/class.entity';
import { TeacherEntity } from '../../modules/teacher/entities/teacher.entity';
import { TeacherSubjectEntity } from '../../modules/teacher/entities/teacher-subject.entity';
import { SubjectEntity } from '../../modules/subject/entities/subject.entity';
import { SubjectGroupEntity } from '../../modules/subject/entities/subject-group.entity';
import { SubjectGradeEntity } from '../../modules/subject/entities/subject-grade.entity';
import { RoomEntity } from '../../modules/room/entities/room.entity';
import { DepartmentEntity } from '../../modules/department/entities/department.entity';
import { DepartmentMemberEntity } from '../../modules/department/entities/department-member.entity';
import { TimetableVersionEntity } from '../../modules/timetable/entities/timetable-version.entity';
import { TimetableSlotEntity } from '../../modules/timetable/entities/timetable-slot.entity';
import { TimetableConstraintEntity } from '../../modules/timetable/entities/timetable-constraint.entity';
import { TeachingAssignmentEntity } from '../../modules/teaching-assignment/entities/teaching-assignment.entity';
import { TeacherSchoolAssignmentEntity } from '../../modules/teacher-school-assignment/entities/teacher-school-assignment.entity';
import { EventEntity } from '../../modules/event/entities/event.entity';
import { LeaveRequestEntity } from '../../modules/leave-request/entities/leave-request.entity';
import { PeriodSwapEntity } from '../../modules/period-swap/entities/period-swap.entity';
import { CurriculumPlanEntity } from '../../modules/curriculum/entities/curriculum-plan.entity';
import { CurriculumPlanItemEntity } from '../../modules/curriculum/entities/curriculum-plan-item.entity';
import { ValidationRuleEntity } from '../../modules/validation-rules/entities/validation-rule.entity';
import { ImportBatchEntity } from '../../modules/import-export/entities/import-batch.entity';
import { ExportTemplateEntity } from '../../modules/import-export/entities/export-template.entity';
import { AttendanceRecordEntity } from '../../modules/attendance/entities/attendance-record.entity';
import { AttendanceSummaryEntity } from '../../modules/attendance/entities/attendance-summary.entity';
import { EmployeeMasterEntity } from '../../modules/master-data/entities/employee-master.entity';
import { FieldDefinitionEntity } from '../../modules/master-data/entities/field-definition.entity';
import { JobRecordEntity } from '../../modules/jobs/entities/job-record.entity';
import { FeatureFlagEntity } from '../../modules/feature-flag/entities/feature-flag.entity';
import { AuditLogEntity } from '../../modules/audit/entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      SchoolEntity,
      CampusEntity,
      AcademicYearEntity,
      SemesterEntity,
      WeekEntity,
      SessionEntity,
      PeriodDefinitionEntity,
      CampusGradeLevelEntity,
      GradeEntity,
      ClassEntity,
      TeacherEntity,
      TeacherSubjectEntity,
      SubjectEntity,
      SubjectGroupEntity,
      SubjectGradeEntity,
      RoomEntity,
      DepartmentEntity,
      DepartmentMemberEntity,
      TimetableVersionEntity,
      TimetableSlotEntity,
      TimetableConstraintEntity,
      TeachingAssignmentEntity,
      TeacherSchoolAssignmentEntity,
      EventEntity,
      LeaveRequestEntity,
      PeriodSwapEntity,
      CurriculumPlanEntity,
      CurriculumPlanItemEntity,
      ValidationRuleEntity,
      ImportBatchEntity,
      ExportTemplateEntity,
      AttendanceRecordEntity,
      AttendanceSummaryEntity,
      EmployeeMasterEntity,
      FieldDefinitionEntity,
      JobRecordEntity,
      FeatureFlagEntity,
      AuditLogEntity,
    ]),
  ],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
