import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export const getJwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_SECRET', 'stms-secret-key'),
  signOptions: {
    expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN_SECONDS', '86400')),
  },
});
