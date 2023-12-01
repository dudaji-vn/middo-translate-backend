import { EventsGateway } from './events.gateway';
import { Module } from '@nestjs/common';

@Module({})
export class EventsModule {
  providers: [EventsGateway];
  exports: [EventsGateway];
}
