import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtUserId, ParamObjectId, Public } from 'src/common/decorators';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { AnalystQueryDto } from './dto/analyst-query-dto';
import { CreateClientDto } from './dto/create-client-dto';
import { CreateOrEditBusinessDto } from './dto/create-or-edit-business-dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { EditClientDto } from './dto/edit-client-dto';
import { HelpDeskService } from './help-desk.service';
import {
  CreateOrEditTagDto,
  CreateOrEditSpaceDto,
  InviteMemberDto,
  RemoveMemberDto,
  UpdateMemberDto,
} from './dto/create-or-edit-space-dto';
import { ValidateInviteDto } from './dto/validate-invite-dto';

@ApiTags('help-desk')
@Controller('help-desk')
export class HelpDeskController {
  constructor(private readonly helpDeskService: HelpDeskService) {}
  @Public()
  @Post('create-client')
  async createClient(@Req() request: Request, @Body() client: CreateClientDto) {
    const result = await this.helpDeskService.createClient(
      client.businessId,
      client,
    );
    return { data: result };
  }

  @Put('create-or-edit-extension')
  async createOrEditBusiness(
    @JwtUserId() userId: string,
    @Body() business: CreateOrEditBusinessDto,
  ) {
    const result = await this.helpDeskService.createOrEditExtension(
      userId,
      business,
    );
    return { data: result };
  }

  @Put('create-or-edit-space')
  async createOrEditSpace(
    @JwtUserId() userId: string,
    @Body() space: CreateOrEditSpaceDto,
  ) {
    const result = await this.helpDeskService.createOrEditSpace(userId, space);
    return { data: result };
  }

  @Get('spaces')
  async getSpacesBy(
    @JwtUserId() userId: string,
    @Query('type') type: 'all_spaces' | 'my_spaces' | 'joined_spaces',
  ) {
    const result = await this.helpDeskService.getSpacesBy(userId, type);
    return {
      data: result,
    };
  }

  @Put('invite-members')
  async inviteMember(
    @JwtUserId() userId: string,
    @Body() member: InviteMemberDto,
  ) {
    const result = await this.helpDeskService.inviteMembers(userId, member);
    return {
      data: result,
    };
  }

  @Get('spaces/:spaceId')
  async getBusinessInfo(
    @JwtUserId() userId: string,
    @Param('spaceId') spaceId: string,
  ) {
    const result = await this.helpDeskService.getSpaceById(userId, spaceId);
    return { data: result };
  }

  @Public()
  @Get('extensions/:id')
  async getBusinessById(@ParamObjectId('id') id: string) {
    const result = await this.helpDeskService.getBusinessById(id);
    return { data: result };
  }

  @Delete('extensions/:id')
  async deleteBusiness(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
  ) {
    await this.helpDeskService.deleteExtension(userId, id);
    return { message: 'Business deleted', data: null };
  }

  @Public()
  @Post('rating')
  async rating(@Body() createRatingDto: CreateRatingDto) {
    const rating = await this.helpDeskService.rating(createRatingDto);
    return { message: 'Rating success', data: rating };
  }

  @Get('my-clients')
  async myClients(
    @Query() query: SearchQueryParamsDto,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.getClientsByUser(query, userId);
    return {
      message: 'My clients',
      data: result,
    };
  }

  @Get('analytics')
  async analytics(
    @Query() query: AnalystQueryDto,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.analyst(query, userId);
    return {
      data: result,
    };
  }

  @Patch('edit-client-profile')
  async editClientProfile(
    @Body() clientDto: EditClientDto,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.editClientProfile(
      clientDto,
      userId,
    );
    return {
      data: result,
      message: 'Edit client profile',
    };
  }

  @Post('validate-invite')
  async validateInvite(
    @Body() { token, status }: ValidateInviteDto,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.validateInvite(
      userId,
      token,
      status,
    );
    return {
      data: result,
    };
  }

  @Get('my-invitations')
  async getMyInvitations(@JwtUserId() userId: string) {
    const result = await this.helpDeskService.getMyInvitations(userId);
    return {
      data: result,
    };
  }

  @Post('resend-invitation')
  async resendInvitation(
    @JwtUserId() userId: string,
    @Body() member: UpdateMemberDto,
  ) {
    const result = await this.helpDeskService.resendInvitation(userId, member);
    return {
      data: result,
    };
  }

  @Patch('change-role')
  async changeRole(
    @JwtUserId() userId: string,
    @Body() member: UpdateMemberDto,
  ) {
    const result = await this.helpDeskService.changeRole(userId, member);
    return {
      data: result,
    };
  }

  @Delete('remove-member')
  async removeMember(
    @JwtUserId() userId: string,
    @Body() member: RemoveMemberDto,
  ) {
    const result = await this.helpDeskService.removeMember(userId, member);
    return {
      data: result,
    };
  }

  @Put('create-or-edit-tag')
  async createOrEditTag(
    @JwtUserId() userId: string,
    @Body() tag: CreateOrEditTagDto,
  ) {
    const result = await this.helpDeskService.createOrEditTag(userId, tag);
    return {
      data: result,
    };
  }

  @Delete('spaces/:spaceId')
  async deleteSpace(
    @JwtUserId() userId: string,
    @ParamObjectId('spaceId') spaceId: string,
  ) {
    const result = await this.helpDeskService.deleteSpace(spaceId, userId);
    return {
      data: result,
    };
  }

  @Delete('tags/:tagId')
  async deleteTag(
    @JwtUserId() userId: string,
    @ParamObjectId('tagId') tagId: string,
    @Body() { spaceId }: { spaceId: string },
  ) {
    const result = await this.helpDeskService.deleteTag(tagId, spaceId, userId);
    return {
      data: result,
    };
  }

  @Get('notifications')
  async getNotifications(@JwtUserId() userId: string) {
    const result = await this.helpDeskService.getNotifications(userId);
    return {
      data: result,
    };
  }

  @Patch('notifications/read/:id')
  async readNotification(@ParamObjectId('id') id: string) {
    const result = await this.helpDeskService.readNotification(id);
    return {
      data: result,
    };
  }

  @Delete('notifications/:id')
  async deleteNotification(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
  ) {
    const result = await this.helpDeskService.deleteNotification(id, userId);
    return {
      data: result,
    };
  }
}
