import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { HelpDeskBusiness } from 'src/help-desk/schemas/help-desk-business.schema';
import { Space } from 'src/help-desk/schemas/space.schema';

export type UserDocument = HydratedDocument<User>;

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BANNED = 'banned',
  UN_SET_INFO = 'unset',
  INACTIVE = 'inactive',
  ANONYMOUS = 'anonymous',
  BOT = 'bot',
}

export enum Provider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  LOCAL = 'local',
  APPLE = 'apple',
}

@Schema({
  timestamps: true,
})
export class User {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({ type: String })
  name: string;
  @Prop({ type: String })
  bio: string;

  @Prop({ type: String })
  email: string;

  @Prop({ type: String })
  password: string;
  @Prop({ type: String })
  avatar: string;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  blacklist: User[];

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  following: User[];

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  followers: User[];
  @Prop({ type: String, default: UserStatus.PENDING })
  status: string;
  @Prop({ type: String })
  verifyToken: string;
  @Prop({ type: String })
  language: string;
  @Prop({ type: String, default: Provider.LOCAL })
  provider: string;
  @Prop({
    type: [{ type: String }],
    default: [],
  })
  pinRoomIds: string[];

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpDeskBusiness',
  })
  business: HelpDeskBusiness;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Space.name,
  })
  space: Space;

  @Prop({ type: String, default: false })
  tempEmail: string;

  @Prop({ type: String })
  phoneNumber: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
// auto delete user if not verify in 24h
UserSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 24 * 60 * 60,
    partialFilterExpression: { status: UserStatus.PENDING },
  },
);
