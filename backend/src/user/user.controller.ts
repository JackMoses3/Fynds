import { Controller, Post, Body, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { RequestUser } from '../types';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('onboarding/additional-info')
  async updateUserOnboarding(
    @Req() req: RequestUser,
    @Body()
    body: { clothingPreferences: string; birthDate: string; location: string },
  ) {
    try {
      return this.userService.update(req.user.sub, {
        clothingPreferences: body.clothingPreferences, // 🧠 map properly
        birthdate: new Date(body.birthDate), // ✅ parse date
        location: body.location,
      });
    } catch (error) {
      console.error('❌ Error in updateUserOnboarding:', error);
      throw error;
    }
  }

  @Post('assign-styles')
  async assignStylesToUser(
    @Req() req: RequestUser,
    @Body() body: { styleIds: number[] },
  ) {
    return this.userService.assignStylesToUser(req.user.sub, body.styleIds);
  }
}
