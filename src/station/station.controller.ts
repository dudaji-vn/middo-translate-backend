import { Body, Controller, Put } from '@nestjs/common';
import { JwtUserId } from '../common/decorators';
import { StationService } from './station.service';
import { CreateOrEditStationDto } from './dto/create-or-edit-station.dto';

@Controller('station')
export class StationController {
  constructor(private readonly stationService: StationService) {}
  @Put('')
  async createOrEditSpace(
    @JwtUserId() userId: string,
    @Body() station: CreateOrEditStationDto,
  ) {
    const result = await this.stationService.createOrEditStation(
      userId,
      station,
    );
    return { data: result };
  }
}
