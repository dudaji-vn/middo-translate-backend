import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtUserId, ParamObjectId, Public } from 'src/common/decorators';
import { CreateClientDto } from './dto/create-client-dto';
import { CreateOrEditBusinessDto } from './dto/create-or-edit-business-dto';
import { HelpDeskService } from './help-desk.service';
import { CreateRatingDto } from './dto/create-rating.dto';

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
}
