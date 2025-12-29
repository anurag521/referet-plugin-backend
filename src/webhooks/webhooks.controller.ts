import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ShopifyService } from '../shopify/shopify.service';
import { ReferralService } from '../referral/referral.service';
import { RewardsService } from '../rewards/rewards.service';

@Controller('webhooks')
export class WebhooksController {

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly referralService: ReferralService,
    private readonly rewardsService: RewardsService,
  ) { }

  @Post('order-created')
  async orderCreated(@Req() req: Request, @Res() res: Response): Promise<void> {
    const order = req.body;
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;

    console.log('Order created webhook received:', {
      orderId: order.id,
      shop: shopDomain,
      email: order.email,
    });

    // 1. Extract Referral Code
    const referralAttr = order.note_attributes?.find(
      (attr) => attr.name === 'referral_code' || attr.name === 'ref_code'
    );

    if (!referralAttr) {
      console.log('No referral code found in order');
      res.status(200).send('No referral');
      return;
    }

    const referralCode = referralAttr.value;

    // Shopify prices are strings e.g "10.00"
    // We assume backend schema uses Integers for money (paisa/cents) logic
    // But check if processPurchase handles it. It expects orderData object.

    if (!order.email || !order.customer) {
      console.log('No customer data in order');
      res.status(200).send('No customer data');
      return;
    }

    // 2. Validate & Process Purchase
    const result = await this.referralService.processPurchase(
      referralCode,
      {
        id: order.id.toString(),
        name: order.name,
        total_price: order.total_price,
        created_at: order.created_at,
        customer: {
          id: order.customer.id,
          email: order.email,
          first_name: order.customer.first_name,
          last_name: order.customer.last_name,
          phone: order.customer.phone
        },
        browser_ip: order.browser_ip || order.client_details?.browser_ip
      }
    );

    if (!result.success) {
      console.log(`Referral validation/processing failed: ${result.reason}`);
      res.status(200).send(`Invalid: ${result.reason}`);
      return;
    }

    const referral = result.referral!;

    // 3. Create Rewards
    try {
      await this.rewardsService.createRewardsForReferral(referral.id);
      console.log('Rewards created successfully (pending approval)');
      res.status(200).send('Referral Processed');
    } catch (error) {
      console.error('Error creating rewards:', error);
      res.status(200).send('Referral Processed (Reward creation failed)');
    }
  }
}
