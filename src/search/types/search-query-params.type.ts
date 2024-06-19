import { FilterQuery } from 'mongoose';

export type SearchQueryParams<T> = {
  query?: FilterQuery<T>;
  params: {
    limit: number;
    q: string;
    spaceId?: string;
    stationId?: string;
  };
};
