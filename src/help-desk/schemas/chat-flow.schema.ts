import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Media } from 'src/messages/schemas/messages.schema';

export enum FlowItemType {
  BUTTON = 'button',
  MESSAGE = 'message',
  ROOT = 'root',
  CONTAINER = 'container',
  OPTION = 'option',
  LINK = 'link',
  FORM = 'form',
}
@Schema({ _id: false })
export class EdgeChatFlow {
  @Prop({ type: String, required: true })
  id: string;
  @Prop({ type: String })
  label: string;

  @Prop({ type: String, required: true })
  source: string;

  @Prop({ type: String, required: true })
  target: string;

  @Prop({ type: Boolean })
  animated: boolean;
}
@Schema({ _id: false })
export class DataNodeChatFlow {
  @Prop({ type: String })
  content: string;
  @Prop({ type: String })
  label?: string;
  @Prop({ type: Array })
  media: Media[];

  @Prop({ type: Array })
  link?: string;
}

@Schema({ _id: false })
export class PositionNodeChatFlow {
  @Prop({ type: Number })
  x: number;

  @Prop({ type: Number })
  y: number;
}

export class Measured {
  @Prop({ type: Number })
  width: number;

  @Prop({ type: Number })
  height: number;
}

@Schema({ _id: false })
export class NodeChatFlow {
  @Prop({ type: String })
  id: string;

  @Prop({ type: String })
  type: FlowItemType;

  @Prop({ type: SchemaFactory.createForClass(DataNodeChatFlow) })
  data: DataNodeChatFlow;

  @Prop({ type: String })
  parentNode: string;

  @Prop({ type: String })
  extent: string;

  @Prop({ type: Number })
  width: number;

  @Prop({ type: Number })
  height: number;

  @Prop({ type: SchemaFactory.createForClass(PositionNodeChatFlow) })
  position: PositionNodeChatFlow;

  @Prop({ type: Boolean })
  draggable: boolean;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  sourcePosition: any;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  targetPosition?: any;

  @Prop({ type: Boolean })
  dragging?: boolean;

  @Prop({ type: Boolean })
  selectable?: boolean;

  @Prop({ type: Boolean })
  connectable?: boolean;

  @Prop({ type: Boolean })
  deletable?: boolean;

  @Prop({ type: String })
  parentId?: string;

  @Prop({ type: Number })
  zIndex?: number;

  @Prop({ type: Boolean })
  expandParent?: boolean;

  @Prop({ type: Boolean })
  focusable?: boolean;

  @Prop({ type: Measured })
  measured?: Measured;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
  })
  form?: any;
}

@Schema({ _id: false })
export class ChatFlow {
  @Prop({ type: [SchemaFactory.createForClass(EdgeChatFlow)], default: [] })
  edges: EdgeChatFlow[];
  @Prop({ type: [SchemaFactory.createForClass(NodeChatFlow)], default: [] })
  nodes: NodeChatFlow[];
}
export const ChatFlowSchema = SchemaFactory.createForClass(ChatFlow);
export const NodeChatFlowSchema = SchemaFactory.createForClass(NodeChatFlow);
