export type UserHelpDeskResponse = {
  totalPage: number;
  items: {
    _id: string;
    name: string;
    email: string;
    firstConnectDate: string;
    lastConnectDate: string;
  }[];
};
