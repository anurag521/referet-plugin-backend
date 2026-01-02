import { Module } from '@nestjs/common';

import { CampaignsModule } from '../campaigns/campaigns.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { PublicController } from './public.controller';

@Module({
    imports: [SupabaseModule, CampaignsModule, ReferralsModule],
    controllers: [PublicController],
    providers: [],
})
export class PublicModule { }
