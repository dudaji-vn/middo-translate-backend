import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service';
import { GetVerifyJwt, JwtUserId, Public } from 'src/common/decorators';
import { UsersService } from 'src/users/users.service';
import { Response } from 'src/common/types';
import { User } from 'src/users/schemas/user.schema';
import { Tokens } from './types';
import { SignUpDto } from './dtos/sign-up.dto';
import { ApiTags } from '@nestjs/swagger';
import { VerifyTokenGuard } from './guards/verify-token.guard';
import { SignInDto } from './dtos/sign-in.dto';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from 'src/users/dto/user-response.dto';

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

  @Get('me')
  async getProfile(@JwtUserId() userId: string): Promise<Response<User>> {
    const user = await this.usersService.getProfile(userId);
    return { message: 'ok', data: user };
  }
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() { email }: { email: string }): Promise<
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
  @Patch('reset-password')
  async resetPassword(
    @GetVerifyJwt() { token, email }: { token: string; email: string },
    @Body() { password }: { password: string },
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
}
