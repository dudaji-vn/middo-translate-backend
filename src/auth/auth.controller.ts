import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

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
  async signUp(@Body() signUpDto: SignUpDto): Promise<Response<null>> {
    await this.authService.signUp(signUpDto);
    return {
      message: 'Check your email to activate your account',
      data: null,
    };
  }

  @Public()
  @Get('sign-in')
  async SignIn(@Body() signInDto: SignInDto): Promise<Response<Tokens>> {
    const tokens = await this.authService.signIn(signInDto);
    return {
      message: 'ok',
      data: tokens,
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
}
