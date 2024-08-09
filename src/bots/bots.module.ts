import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Team, TeamSchema } from 'src/stations/schemas/team.schema';
import { StationsModule } from 'src/stations/stations.module';
import { UsersModule } from 'src/users/users.module';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';
import { Bot, BotSchema } from './schemas/bot.schema';
import { ScopeBot, ScopeBotSchema } from './schemas/scope-bot.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bot.name, schema: BotSchema },
      { name: Team.name, schema: TeamSchema },
      { name: ScopeBot.name, schema: ScopeBotSchema },
    ]),
    UsersModule,
    StationsModule,
  ],
  controllers: [BotsController],
  providers: [BotsService],
})
export class BotsModule {}
