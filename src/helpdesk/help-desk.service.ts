import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoomsService } from 'src/rooms/rooms.service';
import { UsersService } from 'src/users/users.service';
import { HelpDesk } from './schemas/help-desk.schema';

@Injectable()
export class HelpDeskService {
  constructor(
    private readonly usersService: UsersService,
    private readonly roomsService: RoomsService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(HelpDesk.name) private helpDeskModel: Model<HelpDesk>,
  ) {}
}
