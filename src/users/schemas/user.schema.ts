import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, ObjectId } from 'mongoose';
import { HelpDeskBusiness } from 'src/help-desk/schemas/help-desk-business.schema';
import { Space } from 'src/help-desk/schemas/space.schema';
import { Station } from 'src/stations/schemas/station.schema';

export type UserDocument = HydratedDocument<User>;

export enum UserRelationType {
  BLOCKED = 'blocked',
  BLOCKING = 'blocking',
  ME = 'me',
  NONE = 'none',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BANNED = 'banned',
  UN_SET_INFO = 'unset',
  INACTIVE = 'inactive',
  ANONYMOUS = 'anonymous',
  BOT = 'bot',
  DELETED = 'deleted',
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

  @Prop({ type: String, unique: true, index: true })
  email: string;

  @Prop({
    type: String,
    maxlength: 15,
    minlength: 4,
    unique: true,
    index: true,
  })
  username: string;

  @Prop({ type: String })
  password: string;
  @Prop({ type: String })
  avatar: string;

  @Prop({
    type: [{ type: String }],
    default: [],
  })
  blacklist: string[];

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
  @Prop({ type: Boolean, default: true })
  allowUnknown: boolean;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: Station.name }],
    default: [],
  })
  stations: Station[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Station.name })
  defaultStation: ObjectId | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

// auto delete user if not verify in 24h
UserSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 24 * 60 * 60,
    partialFilterExpression: { status: UserStatus.PENDING },
  },
);
