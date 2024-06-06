import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import { Model, Types } from 'mongoose';
import { generateSlug } from 'src/common/utils/generate-slug';
import { envConfig } from 'src/configs/env.config';
import { UsersService } from 'src/users/users.service';
import { CreateOrEditStationDto } from './dto/create-or-edit-station.dto';
import { MemberStatus, ROLE } from './schemas/member.schema';
import { Station, StationStatus } from './schemas/station.schema';

@Injectable()
export class StationsService {
  constructor(
    @InjectModel(Station.name)
    private stationModel: Model<Station>,
    private userService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createStation(userId: string, station: CreateOrEditStationDto) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

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

    const stationData = await this.stationModel.create({
      owner: user._id,
      avatar: station.avatar,
      backgroundImage: station.backgroundImage,
      members: [me, ...members],
      name: station.name,
    });
    return stationData;
  }
  async updateStation(
    id: string,
    userId: string,
    payload: CreateOrEditStationDto,
  ) {
    const stationData = await this.stationModel.findOne({
      _id: id,
      status: { $ne: StationStatus.DELETED },
    });
    if (!stationData) {
      throw new BadRequestException('Station not found');
    }
    if (!this.isOwnerStation(stationData, userId)) {
      throw new ForbiddenException(
        'You do not have permission to edit station',
      );
    }
    if (payload.avatar) {
      stationData.avatar = payload.avatar;
    }
    if (payload.backgroundImage) {
      stationData.backgroundImage = payload.backgroundImage;
    }
    if (payload.name) {
      stationData.name = payload.name;
    }

    await stationData.save();
    const { members: _, ...data } = stationData.toObject();
    return data;
  }

  async getStationByIdAndUserId(id: string, userId: string) {
    const query = {
      _id: id,
      status: StationStatus.ACTIVE,
      members: {
        $elemMatch: {
          user: new Types.ObjectId(userId),
          status: MemberStatus.JOINED,
        },
      },
    };
    const data = await this.stationModel.findOne(query).lean();
    if (!data) {
      throw new BadRequestException(
        `Station ${id} not found or you are not a member is this station.`,
      );
    }
    data.members = data.members.filter(
      (user) => user.status === MemberStatus.JOINED,
    );
    return data;
  }

  async getStations(userId: string) {
    const query = {
      status: StationStatus.ACTIVE,
      members: {
        $elemMatch: {
          user: new Types.ObjectId(userId),
          status: MemberStatus.JOINED,
        },
      },
    };

    const data = await this.stationModel.find(query).lean().sort({ _id: -1 });
    return data.map((item) => {
      const members = item.members.filter(
        (user) => user.status === MemberStatus.JOINED,
      );
      const isOwner = item.owner.toString() === userId;
      const { members: _, ...rest } = item;
      return {
        ...rest,
        isOwner: isOwner,
        totalMembers: members.length,
      };
    });
  }

  private createVerifyUrl(token: string) {
    return `${envConfig.app.url}/station-verify?token=${token}`;
  }
  private isOwnerStation(station: Station, userId: string) {
    return station.owner?.toString() === userId.toString();
  }
}