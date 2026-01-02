import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GenerateReferralDto } from './dto/generate-referral.dto';

@Injectable()
export class ReferralsService {
    constructor(private readonly db: SupabaseService) { }

    // Helper: Get Merchant ID
    private async getMerchantId(shopDomain: string): Promise<string> {
        const res = await this.db.query(`SELECT id FROM merchants WHERE shop_domain = $1`, [shopDomain]);
        if (res.rows.length === 0) {
            throw new BadRequestException('Merchant not found');
        }
        return res.rows[0].id;
    }

    // Helper: Generate a short random code
    private generateCode(length = 6): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async generateReferral(shopDomain: string, dto: GenerateReferralDto) {
        const merchantId = await this.getMerchantId(shopDomain);

        // 1. Strict Campaign Validation
        if (!dto.campaign_id) {
            throw new BadRequestException('campaign_id is required');
        }

        const campaignRes = await this.db.query(
            `SELECT id FROM campaigns WHERE id = $1 AND merchant_id = $2 AND status = 'active'`,
            [dto.campaign_id, merchantId]
        );

        if (campaignRes.rows.length === 0) {
            throw new NotFoundException('Campaign not found or inactive');
        }

        const campaignId = campaignRes.rows[0].id;

        // 2. Find or Create Referrer
        let referrerId: string | null = null;

        // A. Try finding by Shopify Customer ID first (Highest Priority)
        if (dto.customer_id) {
            const referrerRes = await this.db.query(
                `SELECT id FROM referrers WHERE merchant_id = $1 AND shopify_customer_id = $2`,
                [merchantId, dto.customer_id]
            );
            if (referrerRes.rows.length > 0) {
                referrerId = referrerRes.rows[0].id;
            }
        }

        // B. If not found yet, and Email exists, try finding by Email
        if (!referrerId && dto.email) {
            const referrerRes = await this.db.query(
                `SELECT id FROM referrers WHERE merchant_id = $1 AND email = $2`,
                [merchantId, dto.email]
            );
            if (referrerRes.rows.length > 0) {
                // We found them by email. Update their shopify_customer_id if we have it now?
                referrerId = referrerRes.rows[0].id;
                if (dto.customer_id) {
                    await this.db.query(
                        `UPDATE referrers SET shopify_customer_id = $1 WHERE id = $2`,
                        [dto.customer_id, referrerId]
                    );
                }
            }
        }

        // C. Create New Referrer if still not found
        if (!referrerId) {
            // "Name" fallback logic: provided name -> email prefix -> "Guest"
            let name = dto.name;
            if (!name && dto.email) name = dto.email.split('@')[0];
            if (!name) name = 'Customer'; // Fallback if absolutely nothing

            const newReferrer = await this.db.query(
                `INSERT INTO referrers (merchant_id, shopify_customer_id, email, name) 
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [merchantId, dto.customer_id || null, dto.email || null, name]
            );
            referrerId = newReferrer.rows[0].id;
        }

        // 3. Find or Create Referral Code
        const codeRes = await this.db.query(
            `SELECT * FROM referral_codes WHERE referrer_id = $1 AND campaign_id = $2`,
            [referrerId, campaignId]
        );

        if (codeRes.rows.length > 0) {
            return {
                referral_code: codeRes.rows[0].code,
                referral_url: `https://${shopDomain}?ref=${codeRes.rows[0].code}`,
                campaign_id: campaignId
            };
        }

        // Generate unique code
        let code = this.generateCode();
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 5) {
            const check = await this.db.query(`SELECT 1 FROM referral_codes WHERE code = $1`, [code]);
            if (check.rows.length === 0) isUnique = true;
            else {
                code = this.generateCode();
                attempts++;
            }
        }

        if (!isUnique) throw new BadRequestException('Failed to generate unique code, please try again');

        await this.db.query(
            `INSERT INTO referral_codes (code, merchant_id, referrer_id, campaign_id, product_id, variant_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
            [code, merchantId, referrerId, campaignId, dto.product_id || null, dto.variant_id || null]
        );

        return {
            referral_code: code,
            referral_url: `https://${shopDomain}?ref=${code}`,
            campaign_id: campaignId
        };
    }
    async validateReferralCode(shopDomain: string, code: string, refereeCustomerId?: string) {
        const merchantId = await this.getMerchantId(shopDomain);

        // Join to check code AND campaign status together
        const res = await this.db.query(
            `SELECT rc.*, c.status as campaign_status, c.end_date, c.referee_reward_value, c.referee_reward_type
             FROM referral_codes rc
             JOIN campaigns c ON rc.campaign_id = c.id
             WHERE rc.code = $1 AND rc.merchant_id = $2`,
            [code, merchantId]
        );

        if (res.rows.length === 0) {
            return { valid: false, message: 'Invalid Referral Code' };
        }

        const data = res.rows[0];

        if (data.campaign_status !== 'active') {
            return { valid: false, message: 'Campaign is no longer active' };
        }

        if (data.end_date && new Date(data.end_date) < new Date()) {
            return { valid: false, message: 'Campaign has expired' };
        }

        // --- Save Referee Claim ---
        console.log(`[Referral] Validating code ${code} for customer ${refereeCustomerId}`);

        if (refereeCustomerId) {
            try {
                console.log(`[Referral] Attempting to save claim for ${refereeCustomerId}`);
                // Ensure we don't save duplicate claims for same code+customer
                await this.db.query(
                    `INSERT INTO referee_claims (merchant_id, referral_code, referee_customer_id)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (merchant_id, referee_customer_id, referral_code) DO NOTHING`,
                    [merchantId, code, refereeCustomerId]
                );
                console.log(`[Referral] Saved claim for customer ${refereeCustomerId} using code ${code}`);
            } catch (e) {
                console.error("Error saving referee claim:", e);
                // Don't fail the validation just because save failed, but good to know
            }
        } else {
            console.log(`[Referral] No customer ID provided, skipping claim save.`);
        }

        // TODO: Generate or Retrieve actual Shopify Discount Code here.
        const mockDiscount = `REF-${code}`;

        return {
            valid: true,
            discount_code: mockDiscount,
            reward_value: data.referee_reward_value,
            reward_type: data.referee_reward_type,
            message: 'Referral Valid!'
        };
    }
    async trackClick(shopDomain: string, code: string, ip?: string, userAgent?: string) {
        const merchantId = await this.getMerchantId(shopDomain);

        try {
            // 1. Check for unique click (debounce 24h)
            // If ip is missing, we can't debounce effectively, so we might skip the check or fall back to UA (rare).
            // Let's assume IP is present usually.
            let isUnique = true;
            if (ip) {
                const recentClick = await this.db.query(
                    `SELECT id FROM referral_clicks 
                     WHERE referral_code = $1 AND ip_address = $2 
                     AND created_at > NOW() - INTERVAL '24 hours'
                     LIMIT 1`,
                    [code, ip]
                );
                if (recentClick.rows.length > 0) {
                    isUnique = false;
                }
            }

            // 2. Always Log the Click (Security/Audit)
            await this.db.query(
                `INSERT INTO referral_clicks (referral_code, ip_address, user_agent, source)
                 VALUES ($1, $2, $3, 'widget')`,
                [code, ip, userAgent]
            );

            // 3. Increment Counter only if unique
            if (isUnique) {
                await this.db.query(
                    `UPDATE referral_codes SET clicks = clicks + 1 WHERE code = $1 AND merchant_id = $2`,
                    [code, merchantId]
                );
            }

            return { success: true, unique: isUnique };
        } catch (e) {
            console.error('[Referrals] Track Click Failed:', e.message);
            return { success: false };
        }
    }
}
