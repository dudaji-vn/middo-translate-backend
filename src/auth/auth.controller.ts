import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  Put,
  Res,
  Req,
} from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';
import { GetVerifyJwt, JwtUserId, Public } from 'src/common/decorators';
import { Response } from 'src/common/types';
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendVerifyEmailDto } from './dto/resend-verify-email.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifyTokenGuard } from './guards/verify-token.guard';
import { Tokens } from './types';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { GetJwtInfo } from 'src/common/decorators/get-jwt-info.decorator';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import { envConfig } from 'src/configs/env.config';
import { SignOutDto } from './dto/sign-out.dto';
import { VerifyTokenGoogle } from './dto/verify-token-google.dto';
import { logger } from 'src/common/utils/logger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}
  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refreshTokens(
    @GetJwtInfo() { id, token }: { token: string; id: string },
  ): Promise<Tokens> {
    return this.authService.refreshTokens(id, token);
  }
  @Get('remote-login')
  async remoteLogin(@JwtUserId() userId: string): Promise<
    Response<{
      tokens: Tokens;
      user: User;
    }>
  > {
    const user = await this.usersService.getProfile(userId);
    const tokens = await this.authService.createTokens({ id: userId });
    return {
      message: 'ok',
      data: {
        tokens,
        user,
      },
    };
  }
  @Public()
  @Post('sign-up')
  async signUp(@Body() signUpDto: SignUpDto): Promise<
    Response<{
      message: string;
    }>
  > {
    await this.authService.signUp(signUpDto);
    return {
      message: 'Check your email to activate your account',
      data: {
        message: 'Check your email to activate your account',
      },
    };
  }

  @Public()
  @Post('sign-in')
  async SignIn(@Body() signInDto: SignInDto): Promise<
    Response<
      Tokens & {
        user: User;
      }
    >
  > {
    const res = await this.authService.signIn(signInDto);
    logger.info(res.user);
    return {
      message: 'ok',
      data: {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      },
    };
  }
  @Public()
  @UseGuards(VerifyTokenGuard)
  @Get('activate-account')
  async activateAccount(
    @GetVerifyJwt() { token, email }: { token: string; email: string },
  ): Promise<Response<null>> {
    await this.authService.activateAccount(token, email);
    return {
      message: 'ok',
      data: null,
    };
  }

  @Public()
  @Post('resend-verify-email')
  async resendVerifyEmail(@Body() { email }: ResendVerifyEmailDto): Promise<
    Response<{
      message: string;
    }>
  > {
    await this.authService.resendVerifyEmail(email);
    return {
      message: 'ok',
      data: {
        message: 'Check your email to activate your account',
      },
    };
  }

  @Get('me')
  async getProfile(@JwtUserId() userId: string): Promise<Response<User>> {
    const user = await this.usersService.getProfile(userId);
    return { message: 'ok', data: user };
  }

  // GOOGLE

  @Public()
  @Get('google')
  @UseGuards(GoogleOauthGuard)
  async googleSignIn() {
    return;
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleSignInCallback(@Req() req: any, @Res() res: any) {
    const user = req.user;
    const tokens = await this.authService.createTokens({ id: user._id });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      path: '/',
    });
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      path: '/',
    });
    res.redirect(
      envConfig.app.url +
        `/api/callback?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`,
    );
  }

  // PASSWORD
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() { email }: ForgotPasswordDto): Promise<
    Response<{
      message: string;
    }>
  > {
    await this.authService.forgotPassword(email);
    return {
      message: 'ok',
      data: {
        message: 'Check your email to reset your password',
      },
    };
  }

  @Public()
  @UseGuards(VerifyTokenGuard)
  @Put('reset-password')
  async resetPassword(
    @GetVerifyJwt() { token, email }: { token: string; email: string },
    @Body() { password }: ResetPasswordDto,
  ): Promise<
    Response<{
      message: string;
    }>
  > {
    await this.authService.resetPassword(token, email, password);
    return {
      message: 'ok',
      data: {
        message: 'Reset password successfully',
      },
    };
  }

  @Patch('change-password')
  async changePassword(
    @JwtUserId() userId: string,
    @Body() changePassword: ChangePasswordDto,
  ): Promise<
    Response<{
      message: string;
    }>
  > {
    await this.authService.changePassword(userId, changePassword);
    return {
      message: 'ok',
      data: {
        message: 'Change password successfully',
      },
    };
  }
  // check email exist
  @Public()
  @Post('check-email')
  async checkEmail(@Body() { email }: { email: string }): Promise<
    Response<{
      isExist: boolean;
      message: string;
    }>
  > {
    const isExist = await this.usersService.isEmailExist(email);
    return {
      message: 'ok',
      data: {
        isExist,
        message: isExist ? 'Email is exist' : 'Email is not exist',
      },
    };
  }

  // refresh token
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refreshToken(
    @GetJwtInfo() { id, token }: { token: string; id: string },
  ): Promise<
    Response<{
      tokens: Tokens;
    }>
  > {
    const tokens = await this.authService.refreshTokens(id, token);
    return {
      message: 'ok',
      data: {
        tokens,
      },
    };
  }
  @Post('sign-out')
  async signOut(
    @JwtUserId() userId: string,
    @Body() data: SignOutDto,
  ): Promise<Response<null>> {
    await this.authService.signOut(userId, data);
    return {
      message: 'ok',
      data: null,
    };
  }

  @Public()
  @Post('verify-token-google')
  async verifyToken(@Body() payload: VerifyTokenGoogle) {
    const data = await this.authService.verifyTokenGoogle(payload);
    return {
      data: data,
    };
  }
}
