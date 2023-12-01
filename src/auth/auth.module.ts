import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from 'src/mail/mail.module';
import { Module } from '@nestjs/common';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
    }),
    UsersModule,
    MailModule,
  ],
  providers: [AuthService, AccessTokenStrategy, RefreshTokenStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
