import { Controller, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { GenerateReferralDto } from './dto/generate-referral.dto';

@Controller('api/referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) { }

  @Post('generate')
  generate(@Body() dto: GenerateReferralDto, @Query('shop') shop: string) {
    if (!shop) throw new BadRequestException('Shop query parameter is required');
    return this.referralsService.generateReferral(shop, dto);
  }
}
