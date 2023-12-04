import { Body, Controller, Get, Post } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { JwtUserId, Public } from 'src/common/decorators';
import { Response } from 'src/common/types';
import { SetupInfoDto } from './dto/setup-info.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Public()
  @Get('')
  async getUsers(): Promise<Response<null>> {
    return {
      message: 'Setup info successfully',
      data: null,
    };
  }
  @Post('setup')
  async setup(
    @JwtUserId() userId: string,
    @Body() setupDto: SetupInfoDto,
  ): Promise<Response<UserResponseDto>> {
    const user = await this.usersService.setUpInfo(userId, setupDto);
    const userResponse = plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
    return {
      message: 'Setup info successfully',
      data: userResponse,
    };
  }
}
