import { SubscriptionType } from './subscribe.dto';

export class CheckSubscribedDto {
  token: string;
  type?: SubscriptionType;
}
