import { Module } from '@nestjs/common';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema } from './schemas/bot.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Bot.name, schema: BotSchema }])],
  controllers: [BotsController],
  providers: [BotsService],
})
export class BotsModule {}
