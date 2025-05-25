import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    // Load mail configuration from environment (with defaults)
    const host = this.config.get<string>('MAIL_HOST', 'smtp.gmail.com');
    const port = this.config.get<number>('MAIL_PORT', 587);
    const secure = this.config.get<boolean>('MAIL_SECURE', false);
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASS');
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const isProd = nodeEnv === 'production';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },

      // In non-production, accept self-signed certificates
      tls: isProd
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  /**
   * Send a generic email.
   */
  async sendMail(to: string, subject: string, html: string) {
    const from = this.config.get<string>('MAIL_USER');
    const info = await this.transporter.sendMail({ from, to, subject, html });
    console.log('✉️  Message sent:', info.messageId);
    return info;
  }

  /**
   * Send the initial verification email.
   */
  async sendVerificationEmail(email: string, code: number) {
    const from = this.config.get<string>('MAIL_USER');
    try {
      const info = await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Verify your email address',
        text: `Your verification code is ${code}.`,
        html: `<p>Your verification code is <b>${code}</b>.</p>`,
      });
      console.log('✉️  Verification email sent:', info.messageId);
    } catch (error) {
      console.error('❌ Error sending verification email:', error);
    }
  }

  /**
   * Send a new verification code (if user requests a resend).
   */
  async sendNewVerificationEmail(email: string, code: number) {
    const from = this.config.get<string>('MAIL_USER');
    try {
      const info = await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Your new verification code',
        text: `Your new verification code is ${code}.`,
        html: `<p>Your new verification code is <b>${code}</b>.</p>`,
      });
      console.log('✉️  New verification email sent:', info.messageId);
    } catch (error) {
      console.error('❌ Error sending new verification email:', error);
    }
  }
}
