import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Phrase } from './schemas/phrase.schema';
import { Model } from 'mongoose';
import { CreatePhraseDto } from './dto/create-phrase.dto';

@Injectable()
export class PhrasesService {
  constructor(@InjectModel(Phrase.name) private phraseModel: Model<Phrase>) {}
  async init(payload: Record<string, string[]>) {
    const phraseDto: CreatePhraseDto[] = Object.keys(payload).map((topic) => {
      return {
        topic: topic,
        items: payload[topic].map((item) => ({
          name: item,
        })),
      };
    });

    await this.phraseModel.insertMany(phraseDto);
    return true;
  }
}
