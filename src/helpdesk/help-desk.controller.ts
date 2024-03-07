import { Body, Controller, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtUserId, Public } from 'src/common/decorators';
import { CreateClientDto } from './dto/create-client-dto';
import { CreateOrEditBusinessDto } from './dto/create-or-edit-business-dto';
import { HelpDeskService } from './help-desk.service';

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
}
