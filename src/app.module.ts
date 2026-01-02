import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ShopifyModule } from './shopify/shopify.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ProductsModule } from './products/products.module';
import { SessionsModule } from './sessions/sessions.module';
import { PublicModule } from './public/public.module';

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
        ReferralsModule,
        ReferralsModule,
        ProductsModule,
        SessionsModule,
        PublicModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
