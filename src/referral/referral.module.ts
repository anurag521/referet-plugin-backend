import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { ShopifyModule } from '../shopify/shopify.module';

@Module({
  imports: [ShopifyModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService]
})
export class ReferralModule {}
