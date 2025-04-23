import {
  Controller,
  Post,
  Get,
  Request,
  UseGuards,
  Body,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { LocalAuthGuard } from './strategies/local/local-auth.guard';
import { JwtAuthGuard } from './strategies/jwt/jwt-auth.guard';
import { GoogleOAuthGuard } from './strategies/google/google-oauth.guard';
import { AuthService } from './auth.service';
import { User } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify.dto';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService,
              private userService: UserService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // We might want to add some error handling to this endpoint for duplicate emails
    console.log('📩 Incoming registration:', registerDto);
    const user = await this.authService.register(registerDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  @Post('verify')
  async verify(@Body() verifyEmailDto: VerifyEmailDto) {
    console.log('📩 Incoming verification:', verifyEmailDto);
    return this.authService.verifyEmail(verifyEmailDto.email, verifyEmailDto.code);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req: ExpressRequest & { user: User }) {
    // The LocalAuthGuard will have already validated the user and populated req.user
    // The full user object is not returned in the response
    return this.authService.login(req.user);
  }

  @Get('login/google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  googleAuthRedirect(@Request() req: ExpressRequest & { user: User }) {
    return this.authService.login(req.user);
  }

  @Post('google/token')
  loginWithGoogleToken(@Body('idToken') idToken: string) {
    return this.authService.validateGoogleToken(idToken)
  }

  @Post('refresh')
  refreshToken(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }
    return this.authService.refreshAccessToken(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check')
  getProfile(@Request() req: ExpressRequest & { user: User }) {
    return req.user;
  }

  @Post('delete')
  deleteUser(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required.');
    }
    return this.userService.removeByEmail(email);
  }

  @Post('new-verification')
  async sendNewVerificationEmail(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required.');
    }
    return this.authService.newValidationCode(email);
}
}