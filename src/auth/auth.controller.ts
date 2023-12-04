import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  Param,
} from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { GetVerifyJwt, JwtUserId, Public } from 'src/common/decorators';
import { Response } from 'src/common/types';
import { UserResponseDto } from 'src/users/dto/user-response.dto';
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifyTokenGuard } from './guards/verify-token.guard';
import { Tokens } from './types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}
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
        user: UserResponseDto;
      }
    >
  > {
    const res = await this.authService.signIn(signInDto);
    const userResponse = plainToInstance(UserResponseDto, res.user, {
      excludeExtraneousValues: true,
    });
    return {
      message: 'ok',
      data: {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: userResponse,
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
  @Get('')
  async resendVerifyEmail(@Param('email') email: string): Promise<
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
  @Post('reset-password')
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
}
