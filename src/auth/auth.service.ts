import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { envConfig } from 'src/configs/env.config';
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}
  async createAccessToken(payload: { id: string }) {
    return this.jwtService.signAsync(payload, {
      secret: envConfig.jwt.accessToken.secret,
      expiresIn: envConfig.jwt.accessToken.expiresIn,
    });
  }

  async createRefreshToken(payload: { id: string }) {
    return this.jwtService.signAsync(payload, {
      secret: envConfig.jwt.refreshToken.secret,
      expiresIn: envConfig.jwt.refreshToken.expiresIn,
    });
  }

  async createTokens(payload: { id: string }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.createAccessToken(payload),
      this.createRefreshToken(payload),
    ]);
    return {
      accessToken,
      refreshToken,
    };
  }
}
