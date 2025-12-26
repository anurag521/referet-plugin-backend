import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReferralModule } from './referral/referral.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ShopifyModule } from './shopify/shopify.module';

import { PrismaModule } from './prisma/prisma.module';

import { RewardsModule } from './rewards/rewards.module';
import { CampaignsModule } from './campaigns/campaigns.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make config available everywhere
      envFilePath: '.env', // Load .env file from root
    }),
    PrismaModule,
    ReferralModule,
    WebhooksModule,
    ShopifyModule,
    RewardsModule,
    CampaignsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
