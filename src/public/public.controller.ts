import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ReferralsService } from '../referrals/referrals.service';

@Controller('api/public')
export class PublicController {
    constructor(
        private readonly campaignsService: CampaignsService,
        private readonly referralsService: ReferralsService
    ) { }

    @Get('campaigns/check')
    async checkCampaign(
        @Query('shop') shop: string,
        @Query('product_id') productId: string
    ) {
        if (!shop) throw new BadRequestException('Shop required');

        // 1. Get All Active Campaigns for Shop
        const campaigns = await this.campaignsService.findAll(shop);
        console.log(`[PublicAPI] Checking campaigns for shop: ${shop}, product: ${productId}`);

        // 2. Find matching campaign for product
        const activeCampaign = campaigns.find(c => {
            if (c.status !== 'active') return false;
            const now = new Date();
            if (new Date(c.start_date) > now) return false;
            if (c.end_date && new Date(c.end_date) < now) return false;

            // Product Logic
            let products: string[] = [];
            try {
                const parsed = typeof c.eligible_products === 'string' ? JSON.parse(c.eligible_products) : c.eligible_products;
                products = Array.isArray(parsed) ? parsed : [];
            } catch (e) { return false; }

            console.log(`[PublicAPI] Campaign ${c.name} products:`, products);

            if (products.includes('all')) return true;

            // Check if any product GID contains the numeric ID
            const isMatch = productId && products.some((p: string) => String(p).includes(String(productId)));
            console.log(`[PublicAPI] Match result for ${productId}: ${isMatch}`);

            return isMatch;
        });

        if (activeCampaign) {
            return {
                active: true,
                campaign_id: activeCampaign.id,
                reward_text: `Give ${activeCampaign.referee_reward_type === 'percentage' ? activeCampaign.referee_reward_value + '%' : '$' + activeCampaign.referee_reward_value}, Get ${activeCampaign.referrer_reward_type === 'percentage' ? activeCampaign.referrer_reward_value + '%' : '$' + activeCampaign.referrer_reward_value}`
            };
        }

        return { active: false };
    }

    @Get('test/seed')
    async seedTestCampaign() {
        const shop = 'jindaal-2.myshopify.com';
        const productId = '9310366662911';

        console.log('Seeding test campaign for:', shop);

        try {
            const campaign = await this.campaignsService.create(shop, {
                name: 'Winter Test Sale (Auto-Seeded)',
                status: 'active' as any,
                reward_type: 'cashback' as any,
                who_gets_reward: 'both' as any,
                referrer_reward_type: 'fixed' as any,
                referrer_reward_value: 10,
                referee_reward_type: 'fixed' as any,
                referee_reward_value: 10,
                eligible_products: [productId], // Array of strings
                start_date: new Date().toISOString(),
                min_order_value: 0
            });
            return { success: true, message: 'Campaign Created', campaign };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    @Post('referrals/create')
    async createReferral(
        @Query('shop') shop: string,
        @Body() body: { campaign_id: string, customer_id?: string, email?: string, product_id?: string, name?: string }
    ) {
        if (!shop) throw new BadRequestException('Shop required');
        if (!body.campaign_id) throw new BadRequestException('Campaign ID required');

        // Prefer customer_id if available, otherwise email
        if (!body.customer_id && !body.email) {
            throw new BadRequestException('Customer ID or Email is required');
        }

        // Call ReferralsService to generate link
        return this.referralsService.generateReferral(shop, {
            campaign_id: body.campaign_id,
            customer_id: body.customer_id, // Pass RAW customer_id
            email: body.email,
            name: body.name,
            product_id: body.product_id
        });
    }
    @Post('referrals/validate')
    async validateReferral(
        @Body() body: { code: string, shop: string, customer_id?: string }
    ) {
        if (!body.shop) throw new BadRequestException('Shop required');
        if (!body.code) throw new BadRequestException('Code required');

        // Optional: We could track that 'customer_id' attempted to use 'code' here for analytics

        return this.referralsService.validateReferralCode(body.shop, body.code, body.customer_id);
    }
}
