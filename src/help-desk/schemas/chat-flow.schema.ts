import { Prop, SchemaFactory, Schema } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// export type FlowItemType =
//   | 'button'
//   | 'message'
//   | 'root'
//   | 'container'
//   | 'option'
//   | 'link';

export enum FlowItemType {
  BUTTON = 'button',
  MESSAGE = 'message',
  ROOT = 'root',
  CONTAINER = 'container',
  OPTION = 'option',
  LINK = 'link',
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
  label: string;
  @Prop({ type: Array })
  imgs?: string[];

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
}

@Schema({ _id: false })
export class ChatFlow extends Document {
  @Prop({ type: [SchemaFactory.createForClass(EdgeChatFlow)], default: [] })
  edges: EdgeChatFlow[];
  @Prop({ type: [SchemaFactory.createForClass(NodeChatFlow)], default: [] })
  nodes: NodeChatFlow[];
}
export const ChatFlowSchema = SchemaFactory.createForClass(ChatFlow);
