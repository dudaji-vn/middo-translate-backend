import { SearchType } from 'src/search/types';

export type FindParams = {
  q: string;
  limit: number;
  type?: SearchType;
  currentPage?: number;
  spaceId?: string;
  stationId?: string;
};
