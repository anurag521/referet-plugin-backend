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
        @Query('product_id') productId: string,
        @Query('collection_ids') collectionIdsParam: string // Comma separated IDs
    ) {
        if (!shop) throw new BadRequestException('Shop required');

        // 1. Get All Active Campaigns for Shop
        const campaigns = await this.campaignsService.findAll(shop);
        // console.log(`[PublicAPI] Checking campaigns for shop: ${shop}, product: ${productId}, collections: ${collectionIdsParam}`);

        const collectionIds = collectionIdsParam ? collectionIdsParam.split(',') : [];

        // 2. Find matching campaign for product
        const activeCampaign = campaigns.find(c => {
            if (c.status !== 'active') return false;
            const now = new Date();
            if (new Date(c.start_date) > now) return false;
            if (c.end_date && new Date(c.end_date) < now) return false;

            // --- ELIGIBILITY CHECK ---

            // 1. Check New Schema (eligible_type / eligible_ids)
            if (c.eligible_type) {
                if (c.eligible_type === 'all') return true;

                if (c.eligible_type === 'product') {
                    // Check if productId is in eligible_ids
                    if (!productId) return false;
                    return c.eligible_ids && c.eligible_ids.includes(String(productId));
                }

                if (c.eligible_type === 'collection') {
                    // Check if ANY of the product's collections is in eligible_ids
                    if (collectionIds.length === 0) return false;
                    // eligible_ids are Shopify Collection IDs
                    return c.eligible_ids && c.eligible_ids.some(id => collectionIds.includes(String(id)));
                }
            }

            return false;
        });

        if (activeCampaign) {
            return {
                active: true,
                campaign_id: activeCampaign.id,
                referrer_reward_value: activeCampaign.referrer_reward_value,
                referrer_reward_type: activeCampaign.referrer_reward_type,
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
                eligible_type: 'product',
                eligible_ids: [productId], // Array of strings
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

    @Post('referrals/click')
    async trackClick(
        @Query('shop') shop: string,
        @Body() body: { code: string },
        // We'd ideally need @Req() for IP/UA but for now let's optionalize it or assume standard headers
        // Just mocking IP/UA extraction for simplicity if @Req isn't imported easily in this snippet context
    ) {
        if (!shop || !body.code) return { success: false }; // Silent fail preferred for tracking

        // TODO: Extract IP and UA from request context
        return this.referralsService.trackClick(shop, body.code, '127.0.0.1', 'Widget/UserAgent');
    }

    @Post('referrals/claim')
    async claim(
        @Query('shop') shop: string,
        @Body() body: { code: string, customer_id: string }
    ) {
        if (!shop) throw new BadRequestException('Shop query parameter is required');
        return this.referralsService.validateReferralCode(shop, body.code, body.customer_id);
    }
}
