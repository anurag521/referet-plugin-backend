import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { ShopifyModule } from '../shopify/shopify.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [ShopifyModule, SupabaseModule],
  controllers: [WebhooksController],
})
export class WebhooksModule { }
