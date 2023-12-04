import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BANNED = 'banned',
  UN_SET_INFO = 'unset',
  INACTIVE = 'inactive',
}

// @Schema({ _id: false })

@Schema({
  timestamps: true,
})
export class User {
  _id: mongoose.Schema.Types.ObjectId;
  @Prop({ type: String })
  name: string;
  @Prop({ type: String, unique: true })
  username: string;
  @Prop({ type: String })
  bio: string;

  @Prop({ type: String, unique: true })
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
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
