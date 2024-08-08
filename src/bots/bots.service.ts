import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBotDto } from './dto/create-bot.dto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Bot } from './schemas/bot.schema';
import mongoose, { Model } from 'mongoose';
import { UsersService } from 'src/users/users.service';
import { generateSlug } from 'src/common/utils/generate-slug';
import { UserStatus } from 'src/users/schemas/user.schema';

@Injectable()
export class BotsService {
  constructor(
    @InjectModel(Bot.name)
    private botModel: Model<Bot>,
    private userService: UsersService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}
  async createBot(payload: CreateBotDto) {
    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();

    try {
      const slug = generateSlug();
      const { name, avatar } = payload;
      const bot = new this.botModel(payload);
      const user = this.userService.initUser({
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

  generateContent(id: string, teamId: string) {
    return 'Generate content';
  }
}
