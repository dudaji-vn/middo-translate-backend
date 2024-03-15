import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtUserId, ParamObjectId, Public } from 'src/common/decorators';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { CreateClientDto } from './dto/create-client-dto';
import { CreateOrEditBusinessDto } from './dto/create-or-edit-business-dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { HelpDeskService } from './help-desk.service';
import { query } from 'express';
import { AnalystQueryDto } from './dto/analyst-query-dto';
import { EditClientDto } from './dto/edit-client-dto';

@ApiTags('help-desk')
@Controller('help-desk')
export class HelpDeskController {
  constructor(private readonly helpDeskService: HelpDeskService) {}
  @Public()
  @Post('create-client')
  async createClient(@Body() client: CreateClientDto) {
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

  @Get('my-business')
  async getBusinessInfo(@JwtUserId() userId: string) {
    const result = await this.helpDeskService.getBusinessByUser(userId);
    return { data: result };
  }

  @Public()
  @Get('/business/:id')
  async getBusinessById(@ParamObjectId() id: string) {
    const result = await this.helpDeskService.getBusinessById(id);
    return { data: result };
  }

  @Delete(':id')
  async deleteBusiness(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ) {
    await this.helpDeskService.deleteBusiness(id, userId);
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

  @Public()
  @Get('analytics')
  async analytics(@Query() query: AnalystQueryDto) {
    const result = await this.helpDeskService.analyst(query);
    return {
      data: result,
    };
  }

  @Put('edit-client-profile')
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
}
