import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { JwtUserId, ParamObjectId, Public } from 'src/common/decorators';
import { Response } from 'src/common/types';
import { SetupInfoDto } from './dto/setup-info.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserRelationType } from './schemas/user.schema';

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
  @Post('check-username-exist')
  async checkUsernameExist(
    @Body('username') username: string,
  ): Promise<Response<boolean>> {
    await this.usersService.checkUsernameIsExist(username);
    return {
      message: 'Check username exist successfully',
      data: true,
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
  // block api
  @Patch(':id/block')
  async blockUser(
    @JwtUserId() userId: string,
    @ParamObjectId('id') targetId: string,
  ): Promise<Response<null>> {
    await this.usersService.blockUser(userId, targetId);
    return {
      data: null,
      message: 'User has been blocked successfully!',
    };
  }
  @Patch(':id/unblock')
  async unblockUser(
    @JwtUserId() userId: string,
    @Body('id') targetId: string,
  ): Promise<Response<null>> {
    await this.usersService.unblockUser(userId, targetId);
    return {
      data: null,
      message: 'User has been unblocked successfully!',
    };
  }
  // check relationship api
  @Get('/:id/relation')
  async checkRelationship(
    @JwtUserId() userId: string,
    @ParamObjectId('id') targetId: string,
  ): Promise<Response<UserRelationType>> {
    const relationship = await this.usersService.checkRelationship(
      userId,
      targetId,
    );
    return {
      data: relationship,
      message: 'Relationship checked successfully!',
    };
  }
}
