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
import { TeacherSchoolAssignmentModule } from '../teacher-school-assignment/teacher-school-assignment.module';
import { TeacherSchoolAssignmentService } from '../teacher-school-assignment/teacher-school-assignment.service';

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
  ],
  controllers: [AuthController, UserController],
  providers: [
    AuthService,
    UserService,
    UserRepository,
    JwtStrategy,
    TokenInvalidationService,
    {
      provide: 'TEACHER_SCHOOL_ASSIGNMENT_SERVICE',
      useExisting: TeacherSchoolAssignmentService,
    },
  ],
  exports: [AuthService, UserService, UserRepository, TokenInvalidationService],
})
export class AuthModule {}
