import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { UserEntity } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(
    query: UserQueryDto,
  ): Promise<{ data: UserEntity[]; total: number }> {
    const [data, total] = await this.userRepository.findAllFiltered(query);
    return { data, total };
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với id: ${id}`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại trong hệ thống');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role,
      schoolId: dto.schoolId || null,
      teacherId: dto.teacherId || null,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findById(id);

    // Check email uniqueness if email is being updated
    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(dto.email);
      if (existingUser) {
        throw new ConflictException('Email đã tồn tại trong hệ thống');
      }
    }

    const updated = await this.userRepository.update(id, {
      ...dto,
      schoolId: dto.schoolId !== undefined ? dto.schoolId || null : undefined,
      teacherId:
        dto.teacherId !== undefined ? dto.teacherId || null : undefined,
    });

    if (!updated) {
      throw new NotFoundException(`Không tìm thấy người dùng với id: ${id}`);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id); // Ensure user exists
    await this.userRepository.softDelete(id);
  }
}
