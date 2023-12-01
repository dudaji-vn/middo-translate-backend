import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { envConfig } from 'src/configs/env.config';
import { join } from 'path';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: envConfig.mail.host,
        port: envConfig.mail.port as number,
        auth: {
          user: envConfig.mail.user,
          pass: envConfig.mail.pass,
        },
      },
      defaults: {
        from: `"Dudaji" <${envConfig.mail.from}>`,
      },
      template: {
        dir: join(__dirname, './templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
      options: {
        partials: {
          dir: join(__dirname, './templates/partials'),
          options: {
            strict: true,
          },
        },
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
