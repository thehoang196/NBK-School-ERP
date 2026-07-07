import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { UserController } from './user.controller';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserEntity } from './entities/user.entity';
import { getJwtConfig } from '../../config/jwt.config';
import { TokenInvalidationService } from './services/token-invalidation.service';
import { PasswordService } from './services/password.service';
import { TeacherSchoolAssignmentModule } from '../teacher-school-assignment/teacher-school-assignment.module';
import { TeacherSchoolAssignmentService } from '../teacher-school-assignment/teacher-school-assignment.service';
import { ContextModule } from '../context/context.module';
import { ContextSessionService } from '../context/services/context-session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [ConfigService],
    }),
    TeacherSchoolAssignmentModule,
    ContextModule,
  ],
  controllers: [AuthController, UserController],
  providers: [
    AuthService,
    UserService,
    UserRepository,
    JwtStrategy,
    TokenInvalidationService,
    PasswordService,
    {
      provide: 'TEACHER_SCHOOL_ASSIGNMENT_SERVICE',
      useExisting: TeacherSchoolAssignmentService,
    },
    {
      provide: 'CONTEXT_SESSION_SERVICE',
      useExisting: ContextSessionService,
    },
  ],
  exports: [AuthService, UserService, UserRepository, TokenInvalidationService, PasswordService],
})
export class AuthModule {}
