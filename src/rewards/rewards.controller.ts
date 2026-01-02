import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('api/rewards')
export class RewardsController {
    constructor(
        private readonly rewardsService: RewardsService,
        private readonly db: SupabaseService
    ) { }

    // 1. GET Balance (For Frontend Widget)
    @Get('balance')
    async getBalance(
        @Query('shop') shop: string,
        @Query('customer_id') customerId: string
    ) {
        if (!shop || !customerId) throw new BadRequestException('Missing shop or customer_id');

        // Fetch both Wallet and Points
        // We need merchant_id first
        const merchantRes = await this.db.query(`SELECT id, currency, point_value FROM merchants WHERE shop_domain = $1`, [shop]);
        if (merchantRes.rows.length === 0) throw new BadRequestException('Merchant not found');

        const merchant = merchantRes.rows[0];
        const merchantId = merchant.id;

        const walletRes = await this.db.query(
            `SELECT balance, currency FROM user_wallets WHERE merchant_id = $1 AND customer_id = $2`,
            [merchantId, customerId]
        );

        const pointsRes = await this.db.query(
            `SELECT points_balance FROM user_points WHERE merchant_id = $1 AND customer_id = $2`,
            [merchantId, customerId]
        );

        return {
            wallet: walletRes.rows[0] || { balance: 0, currency: merchant.currency },
            points: pointsRes.rows[0] || { points_balance: 0 },
            settings: {
                point_value: merchant.point_value,
                currency: merchant.currency
            }
        };
    }

    // 2. Manual Trigger (For Admin/Testing)
    @Post('distribute-manual')
    async manualDistribute(@Body() body: any, @Query('shop') shop: string) {
        // Validation... for now just a passthrough to service for testing
        const merchantRes = await this.db.query(`SELECT id FROM merchants WHERE shop_domain = $1`, [shop]);
        if (merchantRes.rows.length === 0) throw new BadRequestException('Merchant not found');

        return this.rewardsService.distributeReward({
            merchantId: merchantRes.rows[0].id,
            ...body
        });
    }
}
