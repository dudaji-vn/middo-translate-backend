import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { CreateOrEditStationDto } from './dto/create-or-edit-station.dto';
import { StationsService } from './stations.service';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { ValidateInviteDto } from './dto/validate-invite.dto';

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
    const result = await this.stationsService.findStationByIdAndUserId(
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

  @Delete(':id')
  async deleteStation(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.stationsService.deleteStation(id, userId);
    return { data: result };
  }

  @Delete(':id/members')
  async removeMember(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Body() member: RemoveMemberDto,
  ) {
    const result = await this.stationsService.removeMember(id, userId, member);
    return { data: result };
  }

  @Delete(':id/members/leave')
  async leaveStation(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.stationsService.leaveStation(id, userId);
    return { data: result };
  }

  @Post('members/validate-invite')
  async validateInvite(
    @Body() { token, status }: ValidateInviteDto,
    @JwtUserId() userId: string,
  ) {
    const result = await this.stationsService.validateInvite(
      userId,
      token,
      status,
    );

    return {
      data: result,
    };
  }

  @Patch(':id/set-default')
  async setDefault(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ) {
    const result = await this.stationsService.setDefaultStation(id, userId);
    return {
      data: result,
    };
  }
}
