import { Module } from '@nestjs/common';
import { RoomsModule } from 'src/rooms/rooms.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { UsersModule } from 'src/users/users.module';
import { HelpDeskModule } from '../help-desk/help-desk.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Search, SearchSchema } from './schemas/search.schema';
import { MessagesModule } from 'src/messages/messages.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Search.name, schema: SearchSchema }]),
    UsersModule,
    RoomsModule,
    MessagesModule,
    HelpDeskModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
