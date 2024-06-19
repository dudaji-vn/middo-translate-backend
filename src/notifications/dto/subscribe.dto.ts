export type SubscriptionType = 'extension' | 'other';

export class SubscribeDto {
  token: string;
  type?: SubscriptionType;
}
