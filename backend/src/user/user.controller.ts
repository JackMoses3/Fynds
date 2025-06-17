import { Controller, Post, Body, Req, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { RequestUser } from '../types';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('clothing-preference')
  async getUserClothingPreference(@Req() req: RequestUser) {
    try {
      const user = await this.userService.findOneById(req.user.sub);
      return { clothingPreference: user?.clothingPreferences || 'Both' };
    } catch (error) {
      console.error('❌ Error getting clothing preference:', error);
      throw error;
    }
  }

  @Post('onboarding/additional-info')
  async updateUserOnboarding(
    @Req() req: RequestUser,
    @Body()
    body: { clothingPreferences: string; birthDate: string; location: string },
  ) {
    try {
      return this.userService.update(req.user.sub, {
        clothingPreferences: body.clothingPreferences,
        birthdate: new Date(body.birthDate),
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

  @Post('onboarding/save-selections')
  async saveOnboardingSelections(
    @Req() req: RequestUser,
    @Body() body: { productIds: number[] },
  ) {
    return this.userService.saveOnboardingSelections(
      req.user.sub,
      body.productIds,
    );
  }
}
