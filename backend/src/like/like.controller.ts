import { Controller, Post, Delete, Get, Req, Param } from '@nestjs/common';
import { LikeService } from './like.service';
import { RequestUser } from '../types';

@Controller('like')
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @Post(':productId')
  async like(@Req() req: RequestUser, @Param('productId') productId: number) {
    return this.likeService.likeProduct(req.user.sub, +productId);
  }

  @Delete(':productId')
  async unlike(@Req() req: RequestUser, @Param('productId') productId: number) {
    return this.likeService.unlikeProduct(req.user.sub, +productId);
  }

  @Get()
  async getLiked(@Req() req: RequestUser) {
    return this.likeService.getLikedProductIds(req.user.sub);
  }
}
