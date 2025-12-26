import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignsService {
    constructor(private prisma: PrismaService) { }

    async create(data: any, shopDomain: string) {
        // Check if shop exists in the database (indicating plugin is installed)
        const shop = await this.prisma.shop.findUnique({
            where: { shopId: shopDomain },
        });

        if (!shop) {
            throw new NotFoundException(`Shop ${shopDomain} not found. Please ensure the plugin is installed first.`);
        }

        // Cast to any to bypass temporary TS cache issues after schema update
        return (this.prisma.campaign as any).create({
            data: {
                shopId: shop.id,
                name: data.name,
                status: data.status || 'DRAFT',
                startDate: data.startDate ? new Date(data.startDate) : null,
                endDate: data.endDate ? new Date(data.endDate) : null,
                rewardRecipient: data.rewardRecipient || 'BOTH',
                referrerRewardValue: Number(data.referrerRewardValue) || 0,
                referrerRewardType: data.referrerRewardType || 'FIXED',
                referredRewardValue: Number(data.referredRewardValue) || 0,
                referredRewardType: data.referredRewardType || 'FIXED',
                minOrderValue: Number(data.minOrderValue) || 0,
                usageLimit: data.usageLimit || 'ONCE',
                productIds: data.eligibleProductIds || [],
                rewardExpiryDays: data.rewardExpiryDays ? Number(data.rewardExpiryDays) : null,
                issuanceType: data.issuanceType || 'INSTANT',
                issuanceDays: data.issuanceDays ? Number(data.issuanceDays) : null,
                cancellationPolicy: data.cancellationPolicy || 'VOID_ON_RETURN',
            },
        });
    }

    async findAll(shopDomain: string) {
        const shop = await this.prisma.shop.findUnique({
            where: { shopId: shopDomain },
        });

        if (!shop) return [];

        return this.prisma.campaign.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.campaign.findUnique({
            where: { id },
        });
    }

    async update(id: string, data: any) {
        return (this.prisma.campaign as any).update({
            where: { id },
            data: {
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
            },
        });
    }

    async remove(id: string) {
        return this.prisma.campaign.delete({
            where: { id },
        });
    }
}
