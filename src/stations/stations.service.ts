import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as moment from 'moment';
import { Model, ObjectId, Types } from 'mongoose';
import { AppNotificationsService } from 'src/app-notifications/app-notifications.service';
import { generateSlug } from 'src/common/utils/generate-slug';
import { socketConfig } from 'src/configs/socket.config';
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateOrEditStationDto } from './dto/create-or-edit-station.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { Member, MemberStatus, ROLE } from './schemas/member.schema';
import { Station, StationStatus } from './schemas/station.schema';
import { ValidateInviteStatus } from './dto/validate-invite.dto';
import { envConfig } from 'src/configs/env.config';
import { MailService } from 'src/mail/mail.service';
import {
  InviteMemberByUserDto,
  InviteMemberDto,
  InviteMemberWithLink,
} from './dto/invite-member.dto';
import { MemberDto, MemberWithUserDto } from './dto/member.dto';
import { RoomStatus } from 'src/rooms/schemas/room.schema';
import { InvitationStation } from './schemas/invitation-station.schema';

@Injectable()
export class StationsService {
  constructor(
    @InjectModel(Station.name)
    private stationModel: Model<Station>,
    @InjectModel(InvitationStation.name)
    private invitationStationModel: Model<InvitationStation>,
    private userService: UsersService,
    private appNotificationsService: AppNotificationsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mailService: MailService,
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

    const members = station.members.map((item) =>
      this.convertMemberDtoToMember(item),
    );

    const stationData = await this.stationModel.create({
      owner: user._id,
      avatar: station.avatar,
      backgroundImage: station.backgroundImage,
      members: [me, ...members],
      name: station.name,
    });

    await this.userService.addMemberToStation(
      user._id.toString(),
      stationData._id.toString(),
    );

    const memberPromises = members.map((member) =>
      this.processMember(user, member, stationData),
    );
    await Promise.all(memberPromises);
    const stationDataObject = stationData.toObject();

    return {
      ...stationDataObject,
      members: stationDataObject.members.map((item) => {
        const { verifyToken: _, ...data } = item;
        return data;
      }),
    };
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

  async stationVerify(userId: string, token: string) {
    const user = await this.userService.findById(userId);
    const station = await this.stationModel
      .findOne({
        'members.verifyToken': token,
      })
      .populate('owner', 'email')
      .select('name avatar backgroundImage members owner status')
      .lean();

    if (!station) {
      throw new BadRequestException('Token is invalid');
    }

    if (station.status === StationStatus.DELETED) {
      throw new BadRequestException('This station is deleted');
    }

    const member = station.members.find((item) => item.verifyToken === token);

    if (!member || member.email !== user.email) {
      throw new ForbiddenException(
        'You do not have permission to view this invitation',
      );
    }

    if (member.status === MemberStatus.JOINED) {
      throw new ConflictException('You have already joined this station');
    }
    if (
      moment().isAfter(member.expiredAt) ||
      member.status !== MemberStatus.INVITED
    ) {
      throw new GoneException('Token is expired');
    }
    return {
      station: {
        _id: station._id,
        avatar: station.avatar,
        backgroundImage: station.backgroundImage,
        name: station.name,
        owner: station.owner,
      },
      email: member.email,
      verifyToken: member.verifyToken,
      invitedAt: member.invitedAt,
      isExpired: moment().isAfter(member.expiredAt),
    };
  }
  async findStationByIdAndUserId(id: string, userId: string) {
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
    const data = await this.stationModel
      .findOne(query)
      .populate('owner', '_id name avatar username')
      .populate('members.user', '_id name avatar username')
      .select('-members.verifyToken')
      .lean();
    if (!data) {
      throw new BadRequestException(
        `Station ${id} not found or you are not a member is this station.`,
      );
    }
    data.members = data.members.filter(
      (user) => user.status !== MemberStatus.DELETED,
    );
    return data;
  }

  async getStations(userId: string) {
    const query = [
      {
        $match: {
          status: StationStatus.ACTIVE,
          members: {
            $elemMatch: {
              user: new Types.ObjectId(userId),
              status: MemberStatus.JOINED,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'rooms',
          let: { stationId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$$stationId', '$station'] },
                    { $eq: [RoomStatus.ACTIVE, '$status'] },
                    {
                      $eq: [
                        {
                          $indexOfArray: [
                            '$readBy',
                            new Types.ObjectId(userId),
                          ],
                        },
                        -1,
                      ],
                    },
                    {
                      $eq: [
                        {
                          $indexOfArray: [
                            '$deleteFor',
                            new Types.ObjectId(userId),
                          ],
                        },
                        -1,
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'rooms',
        },
      },
      {
        $addFields: {
          totalNewMessages: { $size: '$rooms' },
        },
      },
      {
        $project: {
          name: 1,
          avatar: 1,
          backgroundImage: 1,
          joinedAt: 1,
          createdAt: 1,
          owner: 1,
          'members.email': 1,
          'members.joinedAt': 1,
          'members.status': 1,
          totalNewMessages: 1,
        },
      },
    ];

    const data = await this.stationModel.aggregate(query).sort({ _id: -1 });
    return data.map((item) => {
      const members = (item.members as Member[]).filter(
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

  async inviteMembersWithEmails(
    stationId: string,
    userId: string,
    data: InviteMemberDto,
  ) {
    const user = await this.userService.findById(userId);
    const stationData = await this.stationModel.findOne({
      _id: stationId,
      status: { $ne: StationStatus.DELETED },
    });

    if (!stationData) {
      throw new BadRequestException('Station not found!');
    }

    data.members.forEach((member) => {
      const user = stationData.members.find(
        (item) =>
          item.email === member.email && item.status !== MemberStatus.DELETED,
      );
      if (user?.status === MemberStatus.INVITED) {
        throw new BadRequestException(`Email ${user.email} already invited!`);
      }
      if (user?.status === MemberStatus.JOINED) {
        throw new BadRequestException(`Email ${user.email} already joined!`);
      }
    });

    const uniqueEmails = new Set();
    const newMembers = data.members
      .filter((member) => {
        if (!uniqueEmails.has(member.email)) {
          uniqueEmails.add(member.email);
          return true;
        }
        return false;
      })
      .map((item) => this.convertMemberDtoToMember(item));

    stationData.members.push(...newMembers);
    await stationData.save();

    const memberPromises = newMembers.map((member) =>
      this.processMember(user, member, stationData),
    );
    await Promise.all(memberPromises);
    return stationData.members.map((item) => {
      return {
        user: item.user,
        email: item.email,
        status: item.status,
        invitedAt: item.invitedAt,
        expiredAt: item.expiredAt,
      };
    });
  }

  async inviteMembersWithUserIds(
    stationId: string,
    userId: string,
    data: InviteMemberByUserDto,
  ) {
    const user = await this.userService.findById(userId);
    const stationData = await this.stationModel.findOne({
      _id: stationId,
      status: { $ne: StationStatus.DELETED },
    });

    if (!stationData) {
      throw new BadRequestException('Station not found!');
    }

    for (const member of data.members) {
      const userInfo = await this.userService.findById(member.userId);
      if (!userInfo) {
        throw new BadRequestException(`User ${member.userId} not found`);
      }

      const user = stationData.members.find(
        (item) =>
          item.email === userInfo.email && item.status !== MemberStatus.DELETED,
      );
      if (user?.status === MemberStatus.INVITED) {
        throw new BadRequestException(`Email ${user.email} already invited!`);
      }
      if (user?.status === MemberStatus.JOINED) {
        throw new BadRequestException(`Email ${user.email} already joined!`);
      }
    }

    const uniqueIds = new Set();
    const newMembersPromise = data.members
      .filter((member) => {
        if (!uniqueIds.has(member.userId)) {
          uniqueIds.add(member.userId);
          return true;
        }
        return false;
      })
      .map((item) => this.convertMemberDtoToMemberWithUser(item));
    const newMembers = await Promise.all(newMembersPromise);

    stationData.members.push(...newMembers);
    await stationData.save();

    const memberPromises = newMembers.map((member) =>
      this.processMember(user, member, stationData),
    );
    await Promise.all(memberPromises);
    return stationData.members.map((item) => {
      return {
        user: item.user,
        email: item.email,
        status: item.status,
        invitedAt: item.invitedAt,
        expiredAt: item.expiredAt,
      };
    });
  }

  async removeMember(stationId: string, userId: string, data: RemoveMemberDto) {
    const stationData = await this.stationModel.findOne({
      _id: stationId,
      status: { $ne: StationStatus.DELETED },
    });

    if (!stationData) {
      throw new BadRequestException('Station not found!');
    }
    if (!this.isOwnerStation(stationData, userId)) {
      throw new ForbiddenException(
        'You do not have permission to remove member',
      );
    }

    const index = stationData.members.findIndex(
      (item) =>
        item.email === data.email && item.status !== MemberStatus.DELETED,
    );
    if (index === -1) {
      throw new BadRequestException('This user is not in station');
    }
    if (stationData.members[index]?.user?.toString() === userId) {
      throw new BadRequestException('You can not remove yourself');
    }

    stationData.members[index].status = MemberStatus.DELETED;

    await stationData.save();
    const memberId = stationData.members[index]?.user?.toString();
    if (memberId) {
      this.userService.removeMemberFromStation(memberId, stationId);
      this.eventEmitter.emit(socketConfig.events.station.member.remove, {
        receiverIds: stationData.members
          .filter((member) => member.status === MemberStatus.JOINED)
          .map((item) => item.user?.toString()),
      });
    }

    return true;
  }

  async leaveStation(stationId: string, userId: string) {
    const stationData = await this.stationModel.findOne({
      _id: stationId,
      status: { $ne: StationStatus.DELETED },
    });

    if (!stationData) {
      throw new BadRequestException('Station not found!');
    }

    const index = stationData.members.findIndex(
      (item) =>
        item.user?.toString() === userId && item.status === MemberStatus.JOINED,
    );
    if (this.isOwnerStation(stationData, userId)) {
      throw new BadRequestException('Owner cannot leave station');
    }
    if (index === -1) {
      throw new BadRequestException('This user is not in station');
    }

    stationData.members[index].status = MemberStatus.DELETED;

    await stationData.save();

    const memberId = stationData.members[index]?.user?.toString();
    if (memberId) {
      this.userService.removeMemberFromStation(memberId, stationId);
      this.eventEmitter.emit(socketConfig.events.station.member.leave, {
        receiverIds: stationData.members
          .filter((member) => member.status === MemberStatus.JOINED)
          .map((item) => item.user?.toString()),
      });
    }

    return true;
  }

  async deleteStation(stationId: string, userId: string) {
    const station = await this.stationModel.findOne({
      _id: stationId,
      status: { $ne: StationStatus.DELETED },
    });

    if (!station) {
      throw new BadRequestException('Station not found');
    }
    if (!this.isOwnerStation(station, userId)) {
      throw new ForbiddenException(
        'You do not have permission to delete station',
      );
    }

    station.status = StationStatus.DELETED;
    await this.userService.removeStationFromUser(stationId);
    await station.save();
    return null;
  }

  async validateInvite(
    userId: string,
    token: string,
    status: ValidateInviteStatus,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const station = await this.stationModel.findOne({
      members: {
        $elemMatch: {
          verifyToken: token,
        },
      },
    });

    if (!station) {
      throw new BadRequestException('Token is invalid');
    }
    if (station.status === StationStatus.DELETED) {
      throw new BadRequestException('This station is deleted');
    }

    const memberIndex = station.members.findIndex(
      (item) => item.verifyToken === token,
    );
    const { email, expiredAt } = station.members[memberIndex];

    if (email !== user.email) {
      throw new ForbiddenException(
        'You do not have permission to verify this invitation',
      );
    }
    if (station.members[memberIndex].status === MemberStatus.JOINED) {
      throw new ConflictException('You are joined this station');
    }

    if (moment().isAfter(expiredAt)) {
      throw new GoneException('Token is expired');
    }

    if (
      status === ValidateInviteStatus.DECLINE &&
      station.members[memberIndex].status === MemberStatus.INVITED
    ) {
      station.members[memberIndex].status = MemberStatus.REJECTED;
      await station.save();
    } else {
      station.members[memberIndex].status = MemberStatus.JOINED;
      station.members[memberIndex].joinedAt = new Date();
      station.members[memberIndex].user = userId;
      await this.userService.addMemberToStation(userId, station._id.toString());
      await station.save();
    }

    return true;
  }

  async activeInvitationLink(userId: string, stationId: string) {
    const isExist = await this.getInvitationLink(stationId);
    if (isExist) {
      throw new BadRequestException(
        `Station has exist link, please remove it before active`,
      );
    }
    const station = await this.stationModel.findOne({
      _id: stationId,
      status: StationStatus.ACTIVE,
    });
    if (!station) {
      throw new BadRequestException('Station not found');
    }
    if (!this.isOwnerStation(station, userId)) {
      throw new BadRequestException(
        'Only owner has permission to generate link',
      );
    }
    const token = `${generateSlug()}-${generateSlug()}`;
    const invitationLink = this.createInvitationLinkUrl(stationId, token);
    const data = await this.invitationStationModel.create({
      station: stationId,
      link: invitationLink,
    });

    return data;
  }

  async deleteInvitationLink(userId: string, stationId: string) {
    const station = await this.stationModel.findOne({
      _id: stationId,
      status: StationStatus.ACTIVE,
    });
    if (!station) {
      throw new BadRequestException('Station not found');
    }
    if (!this.isOwnerStation(station, userId)) {
      throw new BadRequestException('Only owner has permission to delete link');
    }
    await this.invitationStationModel.findOneAndDelete({
      station: stationId,
    });
    return null;
  }

  async joinByLink(userId: string, stationId: string, link: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const isValidLink = await this.invitationStationModel.findOne({
      link: link,
      station: stationId,
    });
    if (!isValidLink) {
      throw new BadRequestException('Link is invalid');
    }
    const station = await this.stationModel.findOne({
      _id: stationId,
      status: StationStatus.ACTIVE,
    });
    if (!station) {
      throw new BadRequestException('Station not found');
    }

    const existMember = station.members.find(
      (member) =>
        member.email === user.email && member.status === MemberStatus.JOINED,
    );

    if (existMember) {
      throw new ConflictException('You are joined this station');
    }

    const member: Member = {
      status: MemberStatus.JOINED,
      joinedAt: new Date(),
      user: userId,
      role: ROLE.MEMBER,
      email: user.email,
    };

    const index = station.members.findIndex(
      (member) =>
        member.email === user.email && member.status === MemberStatus.INVITED,
    );
    if (index > -1) {
      station.members[index] = member;
    } else {
      station.members.push(member);
    }
    await this.userService.addMemberToStation(userId, stationId);
    await station.save();
    return true;
  }

  async getInvitationLink(stationId: string) {
    return await this.invitationStationModel.findOne({ station: stationId });
  }
  async inviterMemberWithLink(
    stationId: string,
    userId: string,
    newMember: InviteMemberWithLink,
  ) {
    const { verifyUrl, email } = newMember;
    const urlObj = new URL(verifyUrl);
    const sender = await this.userService.findById(userId);

    const token = urlObj.searchParams.get('token');
    if (!token) {
      throw new BadRequestException('Token is invalid');
    }
    const stationData = await this.stationModel.findOne({
      _id: stationId,
      status: StationStatus.ACTIVE,
    });
    if (!stationData) {
      throw new BadRequestException('station not found');
    }
    const members = stationData.members;

    const isMember = members.find(
      (item) => item.email === email && item.status === MemberStatus.JOINED,
    );
    if (isMember) {
      throw new BadRequestException('Member has joined this station');
    }
    const indexMember = stationData.members.findIndex(
      (item) => item.email === email && item.status === MemberStatus.INVITED,
    );
    const member = {
      email: email,
      role: ROLE.MEMBER,
      verifyToken: token,
      invitedAt: new Date(),
      expiredAt: moment()
        .add(envConfig.station.invite.expireIn, 'day')
        .toDate(),
      status: MemberStatus.INVITED,
    };
    if (indexMember > -1) {
      stationData.members[indexMember] = member;
      await stationData.save();
      await this.processMember(sender, member, stationData);
    } else {
      stationData.members.push(member);
      await stationData.save();
      await this.processMember(sender, member, stationData);
    }

    return true;
  }

  private createVerifyUrl(token: string) {
    return `${envConfig.app.url}/station-verify?token=${token}`;
  }

  private createInvitationLinkUrl(stationId: string, token: string) {
    return `${envConfig.app.url}/station-invitation?stationId=${stationId}&token=${token}`;
  }
  private isOwnerStation(station: Station, userId: string) {
    return station.owner?.toString() === userId.toString();
  }

  private async processMember(
    sender: User,
    member: Member,
    stationData: Station,
  ) {
    if (!member.verifyToken) {
      throw new BadRequestException(
        `verifyToken not found in user ${sender._id}`,
      );
    }

    const verifyUrl = this.createVerifyUrl(member.verifyToken);
    this.mailService.sendMail(
      member.email,
      `${sender.name} has invited you to join the ${stationData.name} station`,
      'verify-member',
      {
        title: `Join the ${stationData.name} station`,
        verifyUrl: `${verifyUrl}`,
      },
    );

    const receiver = await this.userService.findByEmail(member.email, {
      ignoreNotFound: true,
    });

    // If user exists, create notification and emit event
    if (receiver && receiver._id) {
      await this.appNotificationsService.create({
        from: sender._id.toString(),
        to: receiver._id.toString(),
        link: verifyUrl,
        description: `You've been invited to join station ${stationData.name}`,
        stationId: stationData._id.toString(),
      });

      this.eventEmitter.emit(socketConfig.events.app.notification, {
        receiverIds: [receiver._id.toString()],
      });
    }
  }
  async isMember(station: Station, userId: string) {
    return station.members.find(
      (member) =>
        member?.user?.toString() === userId &&
        member.status === MemberStatus.JOINED,
    );
  }
  async setDefaultStation(stationId: string, userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const station = await this.stationModel.findOne({
      _id: stationId,
      status: StationStatus.ACTIVE,
    });
    if (!station) {
      throw new BadRequestException('station not found');
    }
    const isMember = await this.isMember(station, userId);
    if (!isMember) {
      throw new BadRequestException('You are not in the station');
    }

    await this.userService.update(userId, {
      defaultStation: station._id,
    });
    return true;
  }

  async isMemberByParticipants(stationId: string, participants: ObjectId[]) {
    const station = await this.stationModel.findOne({
      _id: stationId,
      status: StationStatus.ACTIVE,
    });

    if (!station) {
      throw new BadRequestException('station not found');
    }
    const memberIds = station.members
      .filter((item) => item.user && item.status === MemberStatus.JOINED)
      .map((item) => item.user?.toString());
    return participants.every((participant) =>
      memberIds.includes(participant.toString()),
    );
  }

  convertMemberDtoToMember(item: MemberDto): Member {
    const token = `${generateSlug()}-${generateSlug()}`;
    return {
      email: item.email,
      role: ROLE.MEMBER,
      verifyToken: token,
      invitedAt: new Date(),
      expiredAt: moment()
        .add(envConfig.station.invite.expireIn, 'day')
        .toDate(),
      status: MemberStatus.INVITED,
    };
  }

  async convertMemberDtoToMemberWithUser(
    item: MemberWithUserDto,
  ): Promise<Member> {
    const token = `${generateSlug()}-${generateSlug()}`;
    const userInfo = await this.userService.findById(item.userId);
    return {
      email: userInfo.email,
      role: ROLE.MEMBER,
      verifyToken: token,
      invitedAt: new Date(),
      expiredAt: moment()
        .add(envConfig.station.invite.expireIn, 'day')
        .toDate(),
      status: MemberStatus.INVITED,
      user: item.userId,
    };
  }
}
