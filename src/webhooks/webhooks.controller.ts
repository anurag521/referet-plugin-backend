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

    // Extract shop domain from webhook headers
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;

    console.log('Order created webhook received:', {
      orderId: order.id,
      shop: shopDomain,
      customerId: order.customer?.id,
      email: order.email,
    });

    // 1. Extract Referral Code
    const referralAttr = order.note_attributes?.find(
      (attr) => attr.name === 'referral_code' || attr.name === 'ref_code'
    );

    // TODO: Also check cookies if available/forwarded?
    // In Shopify webhooks, you don't get cookies.
    // So the frontend MUST have saved the code into Cart Attributes.

    if (!referralAttr) {
      console.log('No referral code found in order');
      res.status(200).send('No referral');
      return;
    }

    const referralCode = referralAttr.value;
    const orderValue = Math.round(parseFloat(order.total_price || '0') * 100); // Convert to cents/paisa

    const buyerEmail = order.email;
    const buyerCustomerId = order.customer?.id ? String(order.customer.id) : null;
    const buyerIp = order.client_details?.browser_ip || order.browser_ip;

    if (!buyerEmail || !buyerCustomerId) {
      console.log('Missing buyer email/id, skipping');
      res.status(200).send('Skipped');
      return;
    }

    // 2. Validate Purchase via Service
    const validationResult = await this.referralService.validatePurchase(
      referralCode,
      orderValue,
      buyerCustomerId,
      buyerEmail,
      buyerIp
    );

    if (!validationResult.valid) {
      console.log(`Referral validation failed: ${validationResult.reason}`);
      res.status(200).send(`Invalid: ${validationResult.reason}`);
      return;
    }

    const referral = validationResult.referral!;

    // 3. Create Reward Record (Pending Approval)
    // 3. Create Reward Record (Pending Approval)
    console.log('Referral approved:', referral.id);

    try {
      await this.rewardsService.createReward(referral.id);
      console.log('Reward created successfully (pending approval)');
      res.status(200).send('Referral Processed');
    } catch (error) {
      console.error('Error creating reward:', error);
      // Do not fail the webhook response significantly if the referral was valid, 
      // maybe log it for manual intervention.
      res.status(200).send('Referral Processed (Reward creation failed)');
    }
  }
}
