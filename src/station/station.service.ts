import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import { Model } from 'mongoose';
import { generateSlug } from 'src/common/utils/generate-slug';
import { envConfig } from 'src/configs/env.config';
import { UsersService } from 'src/users/users.service';
import { CreateOrEditStationDto } from './dto/create-or-edit-station.dto';
import { MemberStatus, ROLE } from './schemas/member.schema';
import { Station, StationStatus } from './schemas/station.schema';

@Injectable()
export class StationService {
  constructor(
    @InjectModel(Station.name)
    private stationModel: Model<Station>,
    private userService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  async createOrEditStation(userId: string, station: CreateOrEditStationDto) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!station.spaceId) {
      const me = {
        email: user.email,
        role: ROLE.ADMIN,
        verifyToken: '',
        status: MemberStatus.JOINED,
        joinedAt: new Date(),
        user: userId,
      };
      if (!station.members) {
        station.members = [];
      }
      const uniqueEmails = new Set();
      station.members = station.members
        .filter((item) => item.email !== me.email)
        .filter((member) => {
          if (!uniqueEmails.has(member.email)) {
            uniqueEmails.add(member.email);
            return true;
          }
          return false;
        });

      const members = station.members.map((item) => {
        const token = `${generateSlug()}-${generateSlug()}`;
        return {
          email: item.email,
          role: item.role,
          verifyToken: token,
          invitedAt: new Date(),
          expiredAt: moment().add('7', 'day').toDate(),
          status: MemberStatus.INVITED,
          verifyUrl: this.createVerifyUrl(token),
        };
      });

      const spaceData = await this.stationModel.create({
        owner: user._id,
        avatar: station.avatar,
        backgroundImage: station.backgroundImage,
        members: [me, ...members],
        name: station.name,
      });

      return spaceData;
    } else {
      const spaceData = await this.stationModel.findOne({
        _id: station.spaceId,
        status: { $ne: StationStatus.DELETED },
      });
      if (!spaceData) {
        throw new BadRequestException('Space not found');
      }
      if (!this.isOwnerStation(spaceData, userId)) {
        throw new ForbiddenException(
          'You do not have permission to edit space',
        );
      }
      if (station.avatar) {
        spaceData.avatar = station.avatar;
      }
      if (station.backgroundImage) {
        spaceData.backgroundImage = station.backgroundImage;
      }
      if (station.name) {
        spaceData.name = station.name;
      }

      await spaceData.save();
      return spaceData;
    }
  }
  createVerifyUrl(token: string) {
    return `${envConfig.app.url}/station-verify?token=${token}`;
  }
  isOwnerStation(station: Station, userId: string) {
    return station.owner?.toString() === userId.toString();
  }
}
