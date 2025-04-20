// src/mailer/mailer.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    const fromEmail = this.configService.get<string>('MAIL_USER');
    const info = await this.transporter.sendMail({
      from: `"Fynds" <${fromEmail}>`,
      to,
      subject,
      html,
    });

    console.log('✉️  Message sent: %s', info.messageId);
    return info;
  }

  async sendVerificationEmail(email: string, code: number) {
    await this.transporter.sendMail({
      to: email,
      subject: 'Verify your email address',
      text: `Your verification code is ${code}.`,
      html: `<p>Your verification code is <b>${code}</b>.</p>`,
    });
  }
}