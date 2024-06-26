import { Provider, UserStatus } from 'src/users/schemas/user.schema';
import { Strategy, VerifyCallback } from 'passport-google-oauth2';

import { HttpException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile } from 'passport';
import { SUPPORTED_LANGUAGES } from 'src/configs/language';
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
    profile: Profile & {
      language: string;
    },
    done: VerifyCallback,
  ): Promise<any> {
    const { emails, photos } = profile;
    const email = emails?.[0]?.value;

    if (!email) {
      done(null, false);
      return;
    }
    const user = await this.usersService.findByEmail(email, {
      ignoreNotFound: true,
    });
    if (user?.provider && user.provider !== Provider.GOOGLE) {
      throw new HttpException('Sign in using another method', 401);
    }

    if (!user?._id) {
      const language = getLanguage(profile?.language);
      const username = await this.usersService.generateUsernameByEmail(email);
      const newUser = await this.usersService.create({
        name: profile.displayName,
        email,
        avatar: photos?.[0]?.value,
        status: UserStatus.ACTIVE,
        language: language,
        provider: Provider.GOOGLE,
        username: username,
      });
      done(null, newUser);
      return;
    }
    done(null, user);
  }
}

export const getLanguage = (languageCode: string) => {
  const isSupported = SUPPORTED_LANGUAGES.find(
    (language) => language.code === languageCode,
  );
  if (isSupported) {
    return languageCode;
  }
  return 'en';
};
