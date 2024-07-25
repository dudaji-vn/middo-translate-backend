import { Prop, Schema } from '@nestjs/mongoose';

export enum LayoutForm {
  SINGLE = 'single',
  MULTIPLE = 'multiple',
}

@Schema({
  _id: false,
})
export class CustomizeSchema {
  @Prop({ type: String })
  theme: string;

  @Prop({ type: String })
  background: string;

  @Prop({ type: String })
  layout: LayoutForm;
}
