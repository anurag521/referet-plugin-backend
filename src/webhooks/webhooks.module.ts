import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ShopifyModule } from '../shopify/shopify.module';
import { ReferralModule } from '../referral/referral.module';

import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [ShopifyModule, ReferralModule, RewardsModule],
  controllers: [WebhooksController]
})
export class WebhooksModule { }
