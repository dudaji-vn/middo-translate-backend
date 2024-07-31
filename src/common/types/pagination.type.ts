export type Pagination<T, P> = {
  items: T[];
  pageInfo: P;
};

export type PageInfo = {
  total: number;
  limit: number;
  page: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type CursorPaginationInfo = {
  endCursor: string;
  hasNextPage: boolean;
  hasPrevPage?: boolean;
  startCursor?: string;
};
