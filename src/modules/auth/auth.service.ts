import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Optional,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from './user.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserEntity } from './entities/user.entity';
import { UserRole } from '../../common/enums/role.enum';
import { PasswordService } from './services/password.service';
import { TeacherSchoolAssignmentService } from '../teacher-school-assignment/teacher-school-assignment.service';
import { ContextSessionService } from '../context/services/context-session.service';

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    schoolId: string | null;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  schoolId: string | null;
  accessibleSchoolIds?: string[];
  tokenVersion?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    @Optional()
    @Inject('TEACHER_SCHOOL_ASSIGNMENT_SERVICE')
    private readonly teacherSchoolAssignmentService: TeacherSchoolAssignmentService | null,
    @Optional()
    @Inject('CONTEXT_SESSION_SERVICE')
    private readonly contextSessionService: ContextSessionService | null,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.validateUser(dto.email, dto.password);

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const accessToken = await this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
      },
    };
  }

  /**
   * Logout user: delete context session from Redis.
   * Does not block the logout flow if Redis is unavailable.
   *
   * @param userId - The user's UUID
   */
  async logout(userId: string): Promise<void> {
    // Delete context session (non-blocking — ContextSessionService handles errors internally)
    if (this.contextSessionService) {
      try {
        await this.contextSessionService.deleteSession(userId);
      } catch (error) {
        this.logger.warn(
          `Failed to delete context session on logout for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Do NOT throw — logout must succeed even if Redis is unavailable
      }
    }
  }

  async validateUser(email: string, password: string): Promise<UserEntity> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await this.passwordService.verify(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    // Auto-rehash if password uses legacy bcrypt
    if (this.passwordService.needsRehash(user.password)) {
      const newHash = await this.passwordService.hash(password);
      await this.userRepository.update(user.id, { password: newHash });
    }

    return user;
  }

  async generateToken(user: UserEntity): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      tokenVersion: Math.floor(Date.now() / 1000),
    };

    // Populate accessibleSchoolIds for teachers
    if (
      user.role === UserRole.TEACHER &&
      user.teacherId &&
      this.teacherSchoolAssignmentService
    ) {
      try {
        const accessibleSchoolIds =
          await this.teacherSchoolAssignmentService.getAccessibleSchoolIds(
            user.teacherId,
          );
        if (accessibleSchoolIds.length > 0) {
          payload.accessibleSchoolIds = accessibleSchoolIds;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch accessible school IDs for teacher ${user.teacherId}: ${error}`,
        );
        // Fallback: use single schoolId if available
        if (user.schoolId) {
          payload.accessibleSchoolIds = [user.schoolId];
        }
      }
    }

    return this.jwtService.sign(payload);
  }

  async register(dto: RegisterDto): Promise<UserEntity> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại');
    }

    const hashedPassword = await this.passwordService.hash(dto.password);

    return this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role,
      schoolId: dto.schoolId || null,
    });
  }

  async findUserById(userId: string): Promise<UserEntity | null> {
    return this.userRepository.findById(userId);
  }
}
