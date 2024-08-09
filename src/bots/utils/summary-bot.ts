import axios from 'axios';
import { SummaryBotType } from '../types/summary-bot.type';
import { envConfig } from 'src/configs/env.config';
import { Readable } from 'stream';
import { StreamableFile } from '@nestjs/common';

export async function apiSummaryBot(
  payload: SummaryBotType,
): Promise<StreamableFile> {
  try {
    const { query, chatHistory } = payload;

    const formData = new FormData();
    formData.append('query', JSON.stringify(query));
    formData.append('chatHistory', JSON.stringify(chatHistory));

    const response = await axios.post(
      `${envConfig.bot.api}/summary`,
      formData,
      {
        responseType: 'stream',
      },
    );
    return new StreamableFile(response.data);
  } catch (err) {
    console.log(err);
    throw new Error('Failed to retrieve stream from API');
  }
}
