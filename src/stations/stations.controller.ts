import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { CreateOrEditStationDto } from './dto/create-or-edit-station.dto';
import { StationsService } from './stations.service';

@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  async getStations(@JwtUserId() userId: string) {
    const result = await this.stationsService.getStations(userId);
    return { data: result };
  }

  @Post()
  async createStation(
    @JwtUserId() userId: string,
    @Body() station: CreateOrEditStationDto,
  ) {
    const result = await this.stationsService.createStation(userId, station);
    return { data: result };
  }

  @Get(':id')
  async getDetailStation(
    @JwtUserId() userId: string,
    @ParamObjectId('id') id: string,
  ) {
    const result = await this.stationsService.getStationByIdAndUserId(
      id,
      userId,
    );
    return { data: result };
  }

  @Patch(':id')
  async updateStation(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Body() station: CreateOrEditStationDto,
  ) {
    const result = await this.stationsService.updateStation(
      id,
      userId,
      station,
    );
    return { data: result };
  }
}
