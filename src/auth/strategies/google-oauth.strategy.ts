import { Strategy, VerifyCallback } from 'passport-google-oauth2';

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile } from 'passport';
import { UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { envConfig } from 'src/configs/env.config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly usersService: UsersService) {
    super({
      clientID: envConfig.google.clientID,
      clientSecret: envConfig.google.clientSecret,
      callbackURL: envConfig.google.callbackURL,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const email = emails?.[0]?.value;
    console.log(profile);
    if (!email) {
      done(null, false);
      return;
    }
    const user = await this.usersService.findByEmail(email, {
      ignoreNotFound: true,
    });
    if (!user?._id) {
      const newUser = await this.usersService.create({
        name: name?.givenName + ' ' + name?.familyName,
        email,
        avatar: photos?.[0]?.value,
        status: UserStatus.UN_SET_INFO,
      });
      done(null, newUser);
      return;
    }
    done(null, user);
  }
}
