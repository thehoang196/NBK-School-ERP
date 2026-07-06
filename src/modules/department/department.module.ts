import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentEntity } from './entities/department.entity';
import { DepartmentMemberEntity } from './entities/department-member.entity';
import { DepartmentRepository } from './department.repository';
import { DepartmentMemberRepository } from './department-member.repository';
import { DepartmentService } from './department.service';
import { DepartmentMemberService } from './department-member.service';
import { DepartmentController } from './department.controller';
import { DepartmentMemberController } from './department-member.controller';
import { TeacherModule } from '../teacher/teacher.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DepartmentEntity, DepartmentMemberEntity]),
    forwardRef(() => TeacherModule),
    AuthModule,
  ],
  controllers: [DepartmentController, DepartmentMemberController],
  providers: [
    DepartmentService,
    DepartmentRepository,
    DepartmentMemberService,
    DepartmentMemberRepository,
  ],
  exports: [
    DepartmentService,
    DepartmentRepository,
    DepartmentMemberService,
    DepartmentMemberRepository,
  ],
})
export class DepartmentModule {}
