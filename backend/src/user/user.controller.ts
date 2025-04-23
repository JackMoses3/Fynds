import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { Request } from 'express';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('onboarding/additional-info')
  @UseGuards(JwtAuthGuard)
  async updateUserOnboarding(
    @Req() req: RequestUser,
    @Body() body: { clothingPreferences: string; birthDate: string; location: string }
  ) {
    try {
      console.log('🟢 Onboarding endpoint hit');
      const user = req as any;
      console.log('🔐 Decoded user:', user?.user);
      console.log('📦 Body:', body);
  
      return this.userService.update(user.user.id, {
        clothingPreferences: body.clothingPreferences, // 🧠 map properly
        birthdate: new Date(body.birthDate),  // ✅ parse date
        location: body.location,
      });
    } catch (error) {
      console.error('❌ Error in updateUserOnboarding:', error);
      throw error;
    }
  }

  @Post('assign-styles')
  @UseGuards(JwtAuthGuard)
    async assignStylesToUser(
        @Req() req: RequestUser,
        @Body() body: { styleIds: number[] }
    ) {
        try {
            console.log('🟢 Assign styles endpoint hit');
            const user = req as any;
            console.log('🔐 Decoded user:', user?.user);
            console.log('📦 Body:', body);

            return this.userService.assignStylesToUser(user.user.id, body.styleIds);
        } catch (error) {
            console.error('❌ Error in assignStylesToUser:', error);
            throw error;
        }
    }
}