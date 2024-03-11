import { Module } from '@nestjs/common';
import { RoomsModule } from 'src/rooms/rooms.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { UsersModule } from 'src/users/users.module';
import { HelpDeskModule } from '../helpdesk/help-desk.module';

@Module({
  imports: [UsersModule, RoomsModule, HelpDeskModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
