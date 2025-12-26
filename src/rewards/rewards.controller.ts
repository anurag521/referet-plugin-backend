import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { RewardsService } from './rewards.service';

@Controller('api/rewards')
export class RewardsController {
    constructor(private readonly rewardsService: RewardsService) { }

    @Post('approve')
    async approveReward(@Body() body: { rewardId: string; approvedBy: string }) {
        return this.rewardsService.approveReward(body.rewardId, body.approvedBy || 'merchant');
    }

    @Get()
    async getRewards(@Query('shopId') shopId: string) {
        if (!shopId) return { error: 'Missing shopId' };
        // In real app, validate shopId matches authenticated user
        return this.rewardsService.getRewards(shopId);
    }
}
