import { Body, Controller, Get, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { JwtUserId, Public } from 'src/common/decorators';
import { UsersService } from 'src/users/users.service';
import { Response } from 'src/common/types';
import { User } from 'src/users/schemas/user.schema';
import { Tokens } from './types';
import { SignUpDto } from './dtos/sign-up.dto';

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
}
