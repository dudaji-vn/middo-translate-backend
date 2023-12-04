import * as bcrypt from 'bcrypt';

import { HttpException, Injectable } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { SignInDto } from './dtos/sign-in.dto';
import { SignUpDto } from './dtos/sign-up.dto';
import { Tokens } from './types';
import { UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { envConfig } from 'src/configs/env.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}
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
    return `${envConfig.app.url}/auth/verify?token=${token}`;
  }

  async createVerifyToken(payload: { id: string }) {
    return this.jwtService.signAsync(payload, {
      secret: envConfig.jwt.verifyToken.secret,
      expiresIn: envConfig.jwt.verifyToken.expiresIn,
    });
  }

  async signIn(signDto: SignInDto): Promise<Tokens> {
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
}
