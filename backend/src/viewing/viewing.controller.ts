import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { ViewingService } from './viewing.service';
import { CreateViewingDto } from './dto/create-viewing.dto';
import { RequestUser } from '../types'; // Import your existing RequestUser type

@Controller('viewing-history')
@UseGuards(JwtAuthGuard)
export class ViewingController {
  constructor(private readonly viewingService: ViewingService) {}

  @Post()
  async recordViewing(@Req() req: RequestUser, @Body() dto: CreateViewingDto) {
    // Now TypeScript knows req.user exists and has the sub property
    return this.viewingService.recordViewing(req.user.sub, dto);
  }

  @Get()
  async getUserViewingHistory(@Req() req: RequestUser) {
    // Now TypeScript knows req.user exists and has the sub property
    return this.viewingService.getUserViewingHistory(req.user.sub);
  }
}
