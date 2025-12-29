import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ShopifyModule } from './shopify/shopify.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';

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
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
