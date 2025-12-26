import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopifyService } from '../shopify/shopify.service';

@Injectable()
export class RewardsService {
    constructor(
        private prisma: PrismaService,
        private shopifyService: ShopifyService,
    ) { }

    // ==================== CREATE PENDING REWARD ====================
    // Called when order is validated in webhook
    async createReward(referralId: string) {
        const referral = await this.prisma.referral.findUnique({
            where: { id: referralId },
            include: { campaign: true }
        });

        if (!referral) throw new NotFoundException('Referral not found');

        // Create reward record
        const reward = await this.prisma.reward.create({
            data: {
                shopId: referral.shopId,
                referralId: referral.id,
                rewardType: referral.campaign.referrerRewardType || 'coupon',
                amount: referral.rewardAmount,
                status: 'pending'
            }
        });

        return reward;
    }

    // ==================== APPROVE REWARD ====================
    async approveReward(rewardId: string, approvedBy: string) {
        const reward = await this.prisma.reward.findUnique({
            where: { id: rewardId },
            include: { referral: true }
        });

        if (!reward) throw new NotFoundException('Reward not found');
        if (reward.status !== 'pending') throw new Error('Reward already processed');

        // Update status to approved
        await this.prisma.reward.update({
            where: { id: rewardId },
            data: {
                status: 'approved',
                approvedBy,
                approvedAt: new Date()
            }
        });

        // Issue Reward immediately (or separate step?)
        // PDF says "Marks reward as Issued" after generating code.
        return this.issueReward(rewardId);
    }

    // ==================== ISSUE REWARD ====================
    async issueReward(rewardId: string) {
        const reward = await this.prisma.reward.findUnique({
            where: { id: rewardId },
            include: { referral: true }
        });

        if (!reward) throw new NotFoundException('Reward not found');

        try {
            if (reward.rewardType === 'coupon') {
                // Generate Shopify Discount Code
                // Format: REWARD-{ReferralSuffix}-{Random}
                const code = `REW-${reward.referral.referralCode.split('-')[1]}-${Date.now().toString().slice(-4)}`;

                // Call Shopify API to create discount
                // We need shop domain. We can get it from Shop table or via relations.
                const shop = await this.prisma.shop.findUnique({ where: { id: reward.shopId } });

                await this.shopifyService.createDiscountCode(
                    code,
                    reward.referral.referralCode, // Usage tracking?
                    reward.amount / 100, // Amount is in cents, Shopify might expect dollars or cents depending on 'fixed_amount' vs 'percentage'. 
                    // If fixed_amount, Shopify usually expects string '10.00'. 
                    // If percentage, '10' for 10%.
                    // Assuming fixed amount for now based on 'amount'.
                    'fixed_amount'
                );

                // Update Reward
                await this.prisma.reward.update({
                    where: { id: rewardId },
                    data: {
                        status: 'issued',
                        couponCode: code,
                        couponExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                    }
                });

                return { status: 'issued', code };
            }

            throw new Error('Unsupported reward type: ' + reward.rewardType);

        } catch (error) {
            console.error('Failed to issue reward:', error);
            // Log failure but don't fail the request completely if possible? 
            // Or rethrow.
            throw error;
        }
    }

    // ==================== GET REWARDS ====================
    async getRewards(shopId: string) {
        return this.prisma.reward.findMany({
            where: { shopId },
            include: { referral: true },
            orderBy: { createdAt: 'desc' }
        });
    }
}
