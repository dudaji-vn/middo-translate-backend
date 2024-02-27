import { Module } from '@nestjs/common';
import { WatchingService } from './watching.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Watching, WatchingSchema } from './schemas/watching.schema';

@Module({
  providers: [WatchingService],
  imports: [
    MongooseModule.forFeature([
      { name: Watching.name, schema: WatchingSchema },
    ]),
  ],
  exports: [WatchingService],
})
export class WatchingModule {}
