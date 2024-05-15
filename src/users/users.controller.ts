import { Body, Controller, Get, Patch } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { JwtUserId, Public } from 'src/common/decorators';
import { Response } from 'src/common/types';
import { SetupInfoDto } from './dto/setup-info.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
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
  @Patch('setup')
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
  @Patch('update')
  async update(
    @JwtUserId() userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<Response<UserResponseDto>> {
    const user = await this.usersService.updateUserInfo(userId, updateUserDto);
    const userResponse = plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
    return {
      message: 'User information updated successfully!',
      data: userResponse,
    };
  }
  @Public()
  @Get('/update-all')
  async updateUsernameAll(): Promise<Response<null>> {
    await this.usersService.updateAllUsername();
    return {
      message: 'User information updated successfully!',
      data: null,
    };
  }

  @Patch('change-password')
  async changePassword(
    @JwtUserId() userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<Response<null>> {
    await this.usersService.changePassword(userId, changePasswordDto);
    return {
      data: null,
      message: 'Your password has been changed successfully!',
    };
  }
}
