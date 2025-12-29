import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ShopifyModule } from '../shopify/shopify.module';
import { ReferralModule } from '../referral/referral.module';
import { RewardsModule } from '../rewards/rewards.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [ShopifyModule, ReferralModule, RewardsModule, SupabaseModule],
  controllers: [WebhooksController],
})
export class WebhooksModule { }
