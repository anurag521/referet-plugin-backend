import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ShopifyModule } from '../shopify/shopify.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ShopifyModule, SupabaseModule, RewardsModule, ProductsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule { }
