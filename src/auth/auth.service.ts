import * as bcrypt from 'bcrypt';

import {
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Provider, User, UserStatus } from 'src/users/schemas/user.schema';

import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { logger } from 'src/common/utils/logger';
import { envConfig } from 'src/configs/env.config';
import { MailService } from 'src/mail/mail.service';
import { NotificationService } from 'src/notifications/notifications.service';
import { UsersService } from 'src/users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignOutDto } from './dto/sign-out.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifyTokenGoogle } from './dto/verify-token-google.dto';
import { Tokens } from './types';
import { getLanguage } from './strategies/google-oauth.strategy';
import { VerifyTokenAppleDto } from './dto/verify-token-apple.dto';
import { generateAvatar } from 'src/common/utils';
import verifyAppleToken from 'verify-apple-id-token';

@Injectable()
export class AuthService {
  private readonly oauthClient;
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly notificationService: NotificationService,
  ) {
    this.oauthClient = new OAuth2Client(
      envConfig.google.clientID,
      envConfig.google.clientSecret,
    );
  }
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

  createVerifyUrl(token: string) {
    return `${envConfig.app.url}/verify?token=${token}`;
  }

  async createVerifyToken(payload: { id: string }) {
    return this.jwtService.signAsync(payload, {
      secret: envConfig.jwt.verifyToken.secret,
      expiresIn: envConfig.jwt.verifyToken.expiresIn,
    });
  }

  async signIn(signDto: SignInDto): Promise<
    Tokens & {
      user: User;
    }
  > {
    const user = await this.usersService.findByEmail(signDto.email, {
      notFoundMessage: 'Invalid email or password',
      notFoundCode: 401,
    });
    const isMatch = await bcrypt.compare(signDto.password, user.password);
    if (!isMatch) {
      throw new HttpException('Invalid email or password', 401);
    }
    if (user.status === UserStatus.PENDING) {
      throw new HttpException('Account not activated', 401);
    }

    const accessToken = await this.createAccessToken({
      id: user._id.toString(),
    });
    const refreshToken = await this.createRefreshToken({
      id: user._id.toString(),
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
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

  async refreshTokens(userId: string, refreshToken: string): Promise<Tokens> {
    await this.usersService.findById(userId);
    const tokens = await this.createTokens({ id: userId });
    return tokens;
  }

  async resendVerifyEmail(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (user.status !== UserStatus.PENDING) {
      throw new HttpException('Account already activated', 409);
    }
    const verifyToken = await this.createVerifyToken({
      id: user.email,
    });
    await this.usersService.update(user._id, {
      verifyToken,
    });
    const verifyUrl = this.createVerifyUrl(verifyToken);
    await this.mailService.sendMail(
      email,
      'Email address verification',
      'verify',
      {
        title: 'Verify your email address!',
        verifyUrl: verifyUrl,
      },
    );
  }

  async signUp(signUpDto: SignUpDto): Promise<void> {
    const isExist = await this.usersService.isEmailExist(signUpDto.email);
    if (isExist) {
      throw new HttpException('Email already exist', 400);
    }
    const verifyToken = await this.createVerifyToken({
      id: signUpDto.email,
    });
    const hashPassword = await bcrypt.hash(signUpDto.password, 10);
    await this.usersService.create({
      email: signUpDto.email,
      password: hashPassword,
      status: UserStatus.PENDING,
      verifyToken,
    });
    const verifyUrl = this.createVerifyUrl(verifyToken);
    await this.mailService.sendMail(
      signUpDto.email,
      'Email address verification',
      'verify',
      {
        title: 'Verify your email address!',
        verifyUrl: verifyUrl,
      },
    );
  }

  async activateAccount(token: string, email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (user.status !== UserStatus.PENDING) {
      throw new HttpException('Account already activated', 409);
    }
    if (user.verifyToken !== token) {
      throw new HttpException('Invalid token', 401);
    }
    await this.usersService.update(user._id, {
      status: UserStatus.UN_SET_INFO,
      verifyToken: '',
    });
    return;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email, {
      notFoundMessage: 'Email not signed up',
      notFoundCode: 404,
    });
    const verifyToken = await this.createVerifyToken({
      id: user.email,
    });
    await this.usersService.update(user._id, {
      verifyToken,
    });
    const resetPasswordUrl = `${envConfig.app.url}/reset-password?token=${verifyToken}`;

    await this.mailService.sendMail(
      email,
      'Reset your password',
      'reset-password',
      {
        title: 'Reset your password!',
        verifyUrl: resetPasswordUrl,
      },
    );
  }

  async checkToken(token: string, email: string): Promise<boolean> {
    const user = await this.usersService.findByEmail(email);
    if (user?.verifyToken !== token) {
      return false;
    }
    return true;
  }

  // PASSWORD
  async resetPassword(
    token: string,
    email: string,
    password: string,
  ): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (user.verifyToken !== token) {
      throw new HttpException('Invalid token', 401);
    }
    // const isChange = await bcrypt.compare(password, user.password);
    // if (isChange) {
    //   throw new HttpException('New password must be different', 400);
    // }
    const hashPassword = await bcrypt.hash(password, 10);
    await this.usersService.update(user._id, {
      password: hashPassword,
      verifyToken: '',
    });
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    const { password, newPassword } = changePasswordDto;
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new HttpException('Invalid password', 401);
    }
    const isChange = await bcrypt.compare(newPassword, user.password);
    if (isChange) {
      throw new HttpException('New password must be different', 400);
    }
    const hashPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(userId, {
      password: hashPassword,
    });
  }

  async socialSignIn(profile: {
    name?: string;
    avatar?: string;
    email: string;
    provider: Provider;
    language: string;
  }): Promise<Tokens & { user: User }> {
    const language = getLanguage(profile.language || 'en');
    let user = await this.usersService.findByEmail(profile.email, {
      ignoreNotFound: true,
    });
    if (!user?._id) {
      user = await this.usersService.create({
        ...profile,
        language,
        status: UserStatus.ACTIVE,
      });
    }
    const accessToken = await this.createAccessToken({
      id: user._id.toString(),
    });
    const refreshToken = await this.createRefreshToken({
      id: user._id.toString(),
    });
    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async signOut(userId: string, { notifyToken }: SignOutDto) {
    logger.info(
      `sign out: userId:${userId}, notifyToken:${notifyToken}`,
      AuthService.name,
    );
    await this.notificationService.deleteToken(userId, notifyToken);
    return;
  }

  async verifyTokenGoogle({ clientID, token }: VerifyTokenGoogle) {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: token,
        audience: clientID,
      });
      if (!ticket || !ticket.getPayload()) {
        throw new UnauthorizedException('Token is not valid');
      }
      const email = ticket.getPayload()?.email;
      if (!email) {
        throw new UnauthorizedException('Cannot read email');
      }
      return await this.socialSignIn({
        name: ticket.getPayload()?.name,
        email,
        provider: Provider.GOOGLE,
        avatar: ticket.getPayload()?.picture,
        language: getLanguage(ticket.getPayload()?.locale || 'en'),
      });
    } catch (err) {
      throw new UnauthorizedException();
    }
  }
  async verifyTokenApple({ identityToken, fullName }: VerifyTokenAppleDto) {
    try {
      const jwtClaims = await verifyAppleToken({
        idToken: identityToken,
        clientId: 'com.dudajivn.middo',
      });
      if (!jwtClaims) {
        throw new UnauthorizedException('Token is not valid');
      }
      const name = fullName?.givenName || jwtClaims.email.split('@')[0];
      return await this.socialSignIn({
        name,
        email: jwtClaims.email,
        avatar: generateAvatar(name),
        provider: Provider.APPLE,
        language: getLanguage('en'),
      });
    } catch (err) {
      console.log(err);
      throw new UnauthorizedException();
    }
  }

  async deleteAccount(userId: string) {
    await this.usersService.delete(userId);
    return true;
  }
}
