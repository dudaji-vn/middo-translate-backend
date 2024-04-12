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
import { CreateOrEditSpaceDto } from './dto/create-or-edit-space-dto';

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

  @Put('create-or-edit-business')
  async createOrEditBusiness(
    @JwtUserId() userId: string,
    @Body() business: CreateOrEditBusinessDto,
  ) {
    const result = await this.helpDeskService.createOrEditBusiness(
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
    @Query('type') type: 'my-spaces' | 'joined-spaces',
  ) {
    const result = await this.helpDeskService.getSpacesBy(userId, type);
    return {
      data: result,
    };
  }

  @Get('my-business')
  async getBusinessInfo(@JwtUserId() userId: string) {
    const result = await this.helpDeskService.getBusinessByUser(userId);
    return { data: result };
  }

  @Public()
  @Get('business/:id')
  async getBusinessById(@ParamObjectId() id: string) {
    const result = await this.helpDeskService.getBusinessById(id);
    return { data: result };
  }

  @Delete('')
  async deleteBusiness(@JwtUserId() userId: string) {
    await this.helpDeskService.deleteBusiness(userId);
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

  @Public()
  @Get('accept-invite')
  async acceptInvite(@Query('token') token: string) {
    const result = await this.helpDeskService.acceptInvite(token);
    return {
      data: result,
    };
  }

  // @Public()
  // @Get(':businessId/recommend')
  // async getRecommendChatByBusinessAndParentId(
  //   @Param('businessId') businessId: string,
  //   @Query('parentId') parentId: string,
  // ) {
  //   const result =
  //     await this.helpDeskService.getRecommendChatByBusinessAndParentId(
  //       businessId,
  //       parentId,
  //     );
  //   return {
  //     data: result,
  //   };
  // }
}
