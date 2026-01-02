import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface DistributeRewardDto {
    merchantId: string;
    campaignId: string;
    referralCode: string;
    orderId: string;
    orderAmount: number; // For percentage calculation
    customerId: string; // The beneficiary (Referrer usually)
}

@Injectable()
export class RewardsService {
    private readonly logger = new Logger(RewardsService.name);

    constructor(private readonly db: SupabaseService) { }

    async distributeReward(dto: DistributeRewardDto) {
        const { merchantId, campaignId, orderId, orderAmount, customerId, referralCode } = dto;

        // 1. Fetch Campaign & Merchant Settings
        // We join them to reduce DB calls
        const res = await this.db.query(
            `SELECT 
                c.referrer_reward_type, 
                c.referrer_reward_value, 
                c.reward_type as output_type, -- 'wallet', 'point', 'cashback'
                m.point_value,
                m.currency
             FROM campaigns c
             JOIN merchants m ON c.merchant_id = m.id
             WHERE c.id = $1 AND m.id = $2`,
            [campaignId, merchantId]
        );

        if (res.rows.length === 0) {
            this.logger.error(`Campaign or Merchant not found for reward distribution. Camp: ${campaignId}`);
            return { success: false, reason: 'Campaign/Merchant not found' };
        }

        const settings = res.rows[0];

        // 2. Calculate BASE Reward (in Currency Value)
        let cashValue = 0;
        if (settings.referrer_reward_type === 'percentage') {
            cashValue = (orderAmount * settings.referrer_reward_value) / 100;
        } else {
            cashValue = settings.referrer_reward_value; // Fixed amount
        }

        // 3. Convert to Output Format (Points vs Cash)
        let finalAmount = cashValue;
        let finalPoints = 0;
        const rewardType = settings.output_type || 'wallet'; // Default to wallet if undefined

        if (rewardType === 'point') {
            const pointValue = settings.point_value || 0.01;
            // Floor the points (usually better not to give fractional points)
            finalPoints = Math.floor(cashValue / pointValue);
            finalAmount = 0; // It's points, not cash in wallet
        } else {
            // Wallet or Cashback -> Keep as cashValue
            finalAmount = cashValue;
        }

        // 4. Transactional Write (Ledger + Balance)
        // Note: Supabase JS client doesn't support complex transactions easily without RPC.
        // We will do it in two steps, but ideally this should be an RPC or a single complex query.
        // For MVP/Resilience, we insert Ledger first (Pending) then Update Balance then Update Ledger (Processed).

        try {
            // A. Insert Ledger (Pending)
            const ledgerRes = await this.db.query(
                `INSERT INTO rewards_ledger 
                (merchant_id, customer_id, campaign_id, referral_code, order_id, reward_type, amount, points, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processed') 
                RETURNING id`,
                [merchantId, customerId, campaignId, referralCode, orderId, rewardType, finalAmount, finalPoints]
            );

            // B. Update Balance
            if (rewardType === 'point') {
                await this.db.query(
                    `INSERT INTO user_points (merchant_id, customer_id, points_balance)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (merchant_id, customer_id) 
                     DO UPDATE SET points_balance = user_points.points_balance + $3, updated_at = NOW()`,
                    [merchantId, customerId, finalPoints]
                );
            } else {
                // Wallet / Cashback
                await this.db.query(
                    `INSERT INTO user_wallets (merchant_id, customer_id, balance, currency)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (merchant_id, customer_id) 
                     DO UPDATE SET balance = user_wallets.balance + $3, updated_at = NOW()`,
                    [merchantId, customerId, finalAmount, settings.currency || 'USD']
                );
            }

            this.logger.log(`Distributed Reward: ${finalPoints > 0 ? finalPoints + ' Pts' : '$' + finalAmount} to ${customerId}`);
            return { success: true, rewardId: ledgerRes.rows[0].id };

        } catch (e) {
            this.logger.error(`Failed to distribute reward: ${e.message}`, e.stack);
            return { success: false, reason: e.message };
        }
    }
}
