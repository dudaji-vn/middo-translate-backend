import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { ObjectId, Document } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';

export enum StatusSpace {
  DELETED = 'deleted',
  ACTIVE = 'active',
}

export enum MemberStatus {
  INVITED = 'invited',
  PENDING = 'pending',
  JOINED = 'joined',
  DELETED = 'deleted',
}

export enum DefaultTag {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export enum ROLE {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Schema({ _id: false })
export class Member {
  @Prop({ type: String, default: MemberStatus.INVITED })
  status: MemberStatus;

  @Prop({ type: String, default: ROLE.MEMBER })
  role: ROLE;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user?: User | string;

  @Prop({ type: String })
  email: string;

  @Prop({ type: String })
  verifyToken: string;

  @Prop({ type: Date })
  invitedAt: Date;

  @Prop({ type: Date })
  joinedAt?: Date;

  @Prop({ type: Date })
  expiredAt?: Date;
}

export const MemberSchema = SchemaFactory.createForClass(Member);

@Schema({})
export class Tag extends Document {
  @Prop({
    type: String,
  })
  color: string;

  @Prop({
    type: String,
    required: true,
  })
  name: string;

  @Prop({
    type: Boolean,
  })
  isDeleted: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  isReadonly: boolean;
}
export const TagSchema = SchemaFactory.createForClass(Tag);

@Schema({
  timestamps: true,
})
export class Space {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  owner: User | string;

  @Prop({
    type: String,
  })
  name: string;

  @Prop({
    type: String,
  })
  avatar: string;

  @Prop({
    type: String,
  })
  backgroundImage: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  })
  bot: User | string;

  @Prop({
    type: [MemberSchema],
    default: [],
  })
  members: Member[];

  @Prop({
    type: [TagSchema],
    default: [
      { name: DefaultTag.PENDING, color: '#FF3333', isReadonly: true },
      { name: DefaultTag.COMPLETED, color: '#00B512', isReadonly: true },
    ],
  })
  tags: Tag[];

  @Prop({ type: String, default: StatusSpace.ACTIVE })
  status: StatusSpace;
}

export const SpaceSchema = SchemaFactory.createForClass(Space);
