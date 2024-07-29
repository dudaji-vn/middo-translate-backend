import { Prop, Schema } from '@nestjs/mongoose';

@Schema({
  _id: false,
})
export class ThankyouSchema {
  @Prop({ type: String })
  image: string;

  @Prop({ type: String })
  subtitle: string;

  @Prop({ type: String })
  title: string;
}
