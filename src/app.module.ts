import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ShopifyModule } from './shopify/shopify.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        SupabaseModule,
        AuthModule,
        WebhooksModule,
        ShopifyModule,
        CampaignsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
