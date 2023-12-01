import { ExtractJwt, Strategy } from 'passport-jwt';

import { Injectable } from '@nestjs/common';
import { JwtPayload } from 'src/auth/types';
import { PassportStrategy } from '@nestjs/passport';
import { envConfig } from 'src/configs/env.config';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-verify',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: envConfig.jwt.accessToken.secret,
    });
  }

  async validate(payload: JwtPayload) {
    return payload;
  }
}
