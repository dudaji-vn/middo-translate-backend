import { Module } from '@nestjs/common';
import { PhrasesController } from './phrases.controller';
import { PhrasesService } from './phrases.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Phrase, PhraseSchema } from './schemas/phrase.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Phrase.name, schema: PhraseSchema }]),
  ],
  controllers: [PhrasesController],
  providers: [PhrasesService],
})
export class PhrasesModule {}
