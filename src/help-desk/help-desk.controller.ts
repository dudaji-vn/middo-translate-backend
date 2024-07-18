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
import { CreateOrEditScriptDto } from './dto/create-or-edit-script-dto';
import { DeleteScriptsDto } from './dto/delete-scripts-dto';
import { VisitorDto } from './dto/visitor-dto';
import { CreateOrEditFormDto } from './dto/create-or-edit-form-dto';

@ApiTags('help-desk')
@Controller('help-desk')
export class HelpDeskController {
  constructor(private readonly helpDeskService: HelpDeskService) {}

  @Public()
  @Post('clients')
  async createClient(@Body() client: CreateClientDto) {
    const result = await this.helpDeskService.createClient(
      client.businessId,
      client,
    );
    return { data: result };
  }

  @Public()
  @Post('rating')
  async rating(@Body() createRatingDto: CreateRatingDto) {
    const rating = await this.helpDeskService.rating(createRatingDto);
    return { message: 'Rating success', data: rating };
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

  @Get('spaces/:id')
  async getBusinessInfo(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
  ) {
    const result = await this.helpDeskService.getSpaceById(userId, id);
    return { data: result };
  }

  @Put('spaces')
  async createOrEditSpace(
    @JwtUserId() userId: string,
    @Body() space: CreateOrEditSpaceDto,
  ) {
    const result = await this.helpDeskService.createOrEditSpace(userId, space);
    return { data: result };
  }

  @Put('spaces/:id/extensions')
  async createOrEditExtension(
    @JwtUserId() userId: string,
    @ParamObjectId() id: string,
    @Body() business: CreateOrEditBusinessDto,
  ) {
    const result = await this.helpDeskService.createOrEditExtension(
      id,
      userId,
      business,
    );
    return { data: result };
  }

  @Post('spaces/:id/invite-members')
  async inviteMember(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
    @Body() member: InviteMemberDto,
  ) {
    const result = await this.helpDeskService.inviteMembers(id, userId, member);
    return {
      data: result,
    };
  }

  @Get('spaces/:id/members')
  async getMembers(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
  ) {
    const result = await this.helpDeskService.getMembers(userId, id);
    return {
      data: result,
    };
  }

  @Public()
  @Get('extensions/:id')
  async getExtensionById(@ParamObjectId('id') id: string) {
    const result = await this.helpDeskService.getExtensionById(id);
    return { data: result };
  }

  @Delete('extensions/:id')
  async deleteExtension(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
  ) {
    await this.helpDeskService.deleteExtension(userId, id);
    return { message: 'Business deleted', data: null };
  }

  @Get('spaces/:id/my-clients')
  async myClients(
    @Query() query: SearchQueryParamsDto,
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.getClientsByUser(
      id,
      query,
      userId,
    );
    return {
      message: 'My clients',
      data: result,
    };
  }

  @Get('spaces/:id/analytics')
  async analytics(
    @Query() query: AnalystQueryDto,
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.analyst(id, query, userId);
    return {
      data: result,
    };
  }

  @Patch('spaces/:id/edit-client-profile')
  async editClientProfile(
    @ParamObjectId('id') id: string,
    @Body() clientDto: EditClientDto,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.editClientProfile(
      id,
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

  @Post('spaces/:id/resend-invitation')
  async resendInvitation(
    @JwtUserId() userId: string,
    @ParamObjectId('id') spaceId: string,
    @Body() member: UpdateMemberDto,
  ) {
    const result = await this.helpDeskService.resendInvitation(
      spaceId,
      userId,
      member,
    );
    return {
      data: result,
    };
  }

  @Patch('spaces/:id/change-role')
  async changeRole(
    @JwtUserId() userId: string,
    @ParamObjectId('id') spaceId: string,
    @Body() member: UpdateMemberDto,
  ) {
    const result = await this.helpDeskService.changeRole(
      spaceId,
      userId,
      member,
    );
    return {
      data: result,
    };
  }

  @Delete('spaces/:id/remove-member')
  async removeMember(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
    @Body() member: RemoveMemberDto,
  ) {
    const result = await this.helpDeskService.removeMember(id, userId, member);
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

  @Put('spaces/:id/tags')
  async createOrEditTag(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
    @Body() tag: CreateOrEditTagDto,
  ) {
    const result = await this.helpDeskService.createOrEditTag(id, userId, tag);
    return {
      data: result,
    };
  }

  @Delete('spaces/:spaceId/tags/:tagId')
  async deleteTag(
    @JwtUserId() userId: string,
    @ParamObjectId('spaceId') spaceId: string,
    @ParamObjectId('tagId') tagId: string,
  ) {
    const result = await this.helpDeskService.deleteTag(spaceId, tagId, userId);
    return {
      data: result,
    };
  }

  @Get('space-verify/:token')
  async spaceVerify(
    @Param('token') token: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.spaceVerify(userId, token);
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

  @Put('spaces/:id/scripts')
  async createOrEditScript(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
    @Body() payload: CreateOrEditScriptDto,
  ) {
    const result = await this.helpDeskService.createOrEditScript(
      id,
      userId,
      payload,
    );
    return { data: result };
  }

  @Get('spaces/:id/scripts')
  async getScriptsBy(
    @Query() query: SearchQueryParamsDto,
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.getScriptsBy(id, query, userId);
    return {
      data: result,
    };
  }

  @Get('spaces/:id/scripts/:scriptId')
  async getScriptsById(
    @ParamObjectId('id') id: string,
    @ParamObjectId('scriptId') scriptId: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.getDetailScript(
      id,
      scriptId,
      userId,
    );
    return {
      data: result,
    };
  }

  @Delete('spaces/:id/scripts/:scriptId')
  async removeScript(
    @ParamObjectId('id') id: string,
    @ParamObjectId('scriptId') scriptId: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.removeScript(
      id,
      scriptId,
      userId,
    );
    return {
      data: result,
    };
  }

  @Delete('spaces/:id/scripts')
  async removeScripts(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Body() { scriptIds }: DeleteScriptsDto,
  ) {
    const result = await this.helpDeskService.removeScripts(
      id,
      userId,
      scriptIds,
    );
    return {
      data: result,
    };
  }

  @Public()
  @Post(':id/visitor')
  async addVisitor(
    @ParamObjectId('id') id: string,
    @Body() visitor: VisitorDto,
  ) {
    const result = await this.helpDeskService.addVisitor(id, visitor);
    return {
      data: result,
    };
  }

  @Put('spaces/:id/forms')
  async createOrEditForm(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
    @Body() payload: CreateOrEditFormDto,
  ) {
    const result = await this.helpDeskService.createOrEditForm(
      id,
      userId,
      payload,
    );
    return { data: result };
  }

  @Public()
  @Get('forms/:formId/:userId')
  async getDetailForm(
    @ParamObjectId('id') id: string,
    @ParamObjectId('formId') formId: string,
    @ParamObjectId('userId') userId: string,
  ) {
    const result = await this.helpDeskService.getDetailForm(formId, userId);
    return { data: result };
  }

  @Get('spaces/:id/forms')
  async getFormsBy(
    @Query() query: SearchQueryParamsDto,
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.helpDeskService.getFormsBy(id, query, userId);
    return { data: result };
  }

  @Public()
  @Post('forms/:formId/:userId')
  async submitFormHelpDesk(
    @ParamObjectId('formId') formId: string,
    @ParamObjectId('userId') userId: string,
  ) {
    const result = await this.helpDeskService.submitForm(formId, userId);
    return { data: result };
  }
}
