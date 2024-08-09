import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { generateSlug } from 'src/common/utils/generate-slug';
import { Team, TeamRole } from 'src/stations/schemas/team.schema';
import { StationsService } from 'src/stations/stations.service';
import { UserStatus } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { AccessControlDto } from './dto/access-control.dto';
import { CreateBotDto } from './dto/create-bot.dto';
import { Bot } from './schemas/bot.schema';
import { ScopeBot, ScopeType } from './schemas/scope-bot.schema';

@Injectable()
export class BotsService {
  constructor(
    @InjectModel(Bot.name)
    private botModel: Model<Bot>,
    @InjectModel(ScopeBot.name)
    private scopeBotModel: Model<ScopeBot>,
    @InjectModel(Team.name)
    private teamModel: Model<Team>,
    private usersService: UsersService,
    private stationsService: StationsService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}
  async createBot(payload: CreateBotDto) {
    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    try {
      const slug = generateSlug();
      const { name, avatar } = payload;
      const bot = new this.botModel(payload);
      const user = this.usersService.initUser({
        status: UserStatus.BOT,
        email: `${slug}@gmail.com`,
        username: name,
        name: name,
        avatar: avatar,
        bot: bot._id,
      });

      bot.user = user;

      await bot.save({ session: transactionSession });
      await user.save({ session: transactionSession });
      await transactionSession.commitTransaction();
      return bot;
    } catch (err: any) {
      if (transactionSession.inTransaction()) {
        await transactionSession.abortTransaction();
      }
      console.log(err);
      throw new BadRequestException(err.message);
    } finally {
      await transactionSession.endSession();
    }
  }

  async updateAccessControl(payload: AccessControlDto, userId: string) {
    const { scopeType, stationId, teams, botId } = payload;
    const station = await this.stationsService.findById(stationId);
    const isOwner = this.stationsService.isOwnerStation(station, userId);
    if (!isOwner) {
      throw new BadRequestException(
        'You do not permission to update access control',
      );
    }
    if (teams && teams.length) {
      for (const team of teams) {
        const existTeam = station.teams.find(
          (item) => item.toString() === team,
        );
        if (!existTeam) {
          throw new BadRequestException(
            `Team id ${team} is not exist in stations`,
          );
        }
      }
    }

    await this.scopeBotModel.findOneAndUpdate(
      {
        station: stationId,
        bot: botId,
      },
      {
        type: scopeType,
        ...(scopeType === ScopeType.SPECIFIC && {
          teams: teams,
        }),
      },
      {
        upsert: true,
        new: true,
      },
    );
    return true;
  }
  async getSummarizeContent(botId: string, stationId: string, userId: string) {
    const bot = await this.botModel.findOne({ _id: botId });
    if (!bot) {
      throw new BadRequestException(`Bot not found`);
    }
    const canAccessBot = await this.canAccessBot(botId, userId, stationId);
    if (!canAccessBot) {
      throw new BadRequestException(`User cannot access this bot`);
    }
    return 'Generate content';
  }

  async getBotsByUser(stationId: string, userId: string) {
    const team = await this.stationsService.getMyTeam(stationId, userId);
    console.log({ team });
    if (!team) {
      return [];
    }

    const botIds = await this.scopeBotModel.find({
      station: stationId,
      $or: [
        {
          type: ScopeType.ALL,
        },
        {
          type: ScopeType.SPECIFIC,
          teams: team._id,
        },
      ],
    });
    return this.botModel.find({
      ...(team.role !== TeamRole.ADMIN && { _id: botIds }),
    });
  }

  private async canAccessBot(botId: string, userId: string, stationId: string) {
    const team = await this.stationsService.getMyTeam(stationId, userId);
    if (!team) {
      return false;
    }

    const result = await this.scopeBotModel.findOne({
      station: stationId,
      bot: botId,
      $or: [
        {
          type: ScopeType.ALL,
        },
        ...(team.role === TeamRole.ADMIN ? [{ type: ScopeType.ADMIN }] : []),
        {
          type: ScopeType.SPECIFIC,
          teams: team._id,
        },
      ],
    });

    if (!result && team.role === TeamRole.ADMIN) {
      return true;
    }
    return !!result;
  }
}
