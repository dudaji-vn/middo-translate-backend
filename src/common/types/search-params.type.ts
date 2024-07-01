export type ListQueryParamsCursor = {
  limit: number;
  cursor: string;
  direction: 'forward' | 'backward';
};

export type ListQueryParams = {
  limit: number;
  page: number;
};
