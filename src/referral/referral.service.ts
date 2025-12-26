import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReferralService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) { }

  // ==================== GENERATE REFERRAL LINK ====================
  async generateReferralLink(
    shopDomain: string,
    email: string,
    productHandle: string = 'home'
  ) {
    // 1. Fetch shop by domain (or create placeholder if dev mode and not found?)
    // In production, Shop should be created on app install.
    let shop = await this.prisma.shop.findUnique({
      where: { shopId: shopDomain },
    });

    if (!shop) {
      // Fallback for development/testing if shop record doesn't exist yet
      console.warn(`Shop ${shopDomain} not found in DB. Creating default record...`);
      shop = await this.prisma.shop.create({
        data: {
          shopId: shopDomain,
          accessToken: 'placeholder', // Should be set via OAuth
          plan: 'basic'
        }
      });

      // Create default campaign
      await (this.prisma.campaign as any).create({
        data: {
          shopId: shop.id,
          name: 'Default Campaign',
          status: 'ACTIVE',
          referrerRewardValue: 1000,
          referredRewardValue: 10,
          minOrderValue: 500
        }
      });
    }

    // 2. Fetch active campaign
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        shopId: shop.id,
        status: 'ACTIVE',
      } as any,
    });

    if (!campaign) {
      // If no campaign exists, ensure one does (fallback)
      // logic skipped for brevity, assuming established above
      throw new BadRequestException('No active campaign found for this shop.');
    }

    // 3. Check if referral already exists for this email+campaign
    let referral = await this.prisma.referral.findFirst({
      where: {
        referrerEmail: email,
        campaignId: campaign.id
      }
    });

    if (referral) {
      return {
        referralCode: referral.referralCode,
        referralUrl: referral.referralUrl,
        reward: {
          referrerAmount: campaign.referrerRewardValue,
          refereeDiscount: (campaign as any).referredRewardValue,
          minOrderValue: campaign.minOrderValue
        },
        expiresAt: referral.expiresAt
      };
    }

    // 4. Generate unique referral code
    const referralCode = this.generateCode(shopDomain);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const referralUrl = `https://${shopDomain}/products/${productHandle}?ref=${referralCode}`;

    // 5. Create referral record
    referral = await this.prisma.referral.create({
      data: {
        shopId: shop.id,
        campaignId: campaign.id,
        referralCode: referralCode,
        referralUrl: referralUrl,
        referrerEmail: email,
        rewardAmount: campaign.referrerRewardValue,
        expiresAt: expiresAt,
        status: 'pending',
      },
    });

    return {
      referralCode,
      referralUrl,
      reward: {
        referrerAmount: campaign.referrerRewardValue,
        referereeDiscount: (campaign as any).referredRewardValue,
        minOrderValue: campaign.minOrderValue,
      },
      expiresAt,
    };
  }

  // ==================== TRACK CLICK ====================
  async trackClick(referralCode: string, ipAddress: string, userAgent: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { referralCode },
    });

    if (!referral) return null;

    // Log click
    await this.prisma.referralClick.create({
      data: {
        referralId: referral.id,
        ipAddress,
        userAgent,
        source: 'web'
      }
    });

    // Update status if it was pending
    if (referral.status === 'pending') {
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'clicked' }
      });
    }

    return referral;
  }

  // ==================== VALIDATE PURCHASE ====================
  async validatePurchase(
    referralCode: string,
    orderTotal: number, // in paisa/cents
    customerId: string,
    customerEmail: string,
    customerIp: string
  ) {
    const referral = await this.prisma.referral.findUnique({
      where: { referralCode },
      include: { campaign: true }
    });

    if (!referral) {
      return { valid: false, reason: 'Referral not found' };
    }

    // Prevent self-referral
    if (referral.referrerEmail === customerEmail) {
      return { valid: false, reason: 'Self-referral detected' };
    }

    // Validate order value
    if (orderTotal < (referral.campaign.minOrderValue || 0)) {
      // Can log rejection reason?
      return { valid: false, reason: 'Min order value not met' };
    }

    // Check expiry
    if (new Date(referral.expiresAt) < new Date()) {
      return { valid: false, reason: 'Referral expired' };
    }

    // Success! Update referral
    const updatedReferral = await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'approved',
        orderTotal: orderTotal,
        refereeCustomerId: customerId,
        refereeEmail: customerEmail,
        refereeIpAddress: customerIp,
        orderDate: new Date() // roughly now
      }
    });

    return { valid: true, referral: updatedReferral };
  }

  // ==================== UTILITY FUNCTIONS ====================
  private generateCode(shopDomain: string): string {
    const prefix = shopDomain.split('.')[0].substring(0, 4).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `REF-${prefix}-${random}`;
  }
}
