import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}
  async sendMail(to: string, subject: string, template: string, context: any) {
    await this.mailerService.sendMail({
      to,
      subject,
      template: template,
      context: {
        mail: context,
      },
    });
    Logger.log(`Send mail to ${to} success`, MailService.name);
  }
}
