import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolStatus } from '../../../common/enums/status.enum';

export class SchoolResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  address: string | null;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  email: string | null;

  @ApiPropertyOptional()
  principalName: string | null;

  @ApiPropertyOptional()
  parentSchoolId: string | null;

  @ApiProperty({ enum: SchoolStatus })
  status: SchoolStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
