import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { AcademicStatus } from '../../../../common/enums/status.enum';

export class TransitionStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới của năm học',
    enum: AcademicStatus,
    example: AcademicStatus.ACTIVE,
  })
  @IsNotEmpty({ message: 'Trạng thái mới không được để trống' })
  @IsEnum(AcademicStatus, {
    message:
      'Trạng thái không hợp lệ. Giá trị hợp lệ: planning, active, completed',
  })
  newStatus: AcademicStatus;
}
