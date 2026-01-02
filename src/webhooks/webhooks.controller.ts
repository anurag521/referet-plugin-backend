import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ShopifyService } from '../shopify/shopify.service';
import { RewardsService } from '../rewards/rewards.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ProductsService } from '../products/products.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly rewardsService: RewardsService,
    private readonly db: SupabaseService,
    private readonly productsService: ProductsService,
  ) { }

  @Post('orders/paid')
  async handleOrderPaid(
    @Body() order: any,
    @Headers('x-shopify-shop-domain') shopDomain: string
  ) {
    this.logger.log(`Received Order Paid Webhook for shop: ${shopDomain}, Order ID: ${order.id}`);

    if (!shopDomain) {
      this.logger.error('Missing shop domain in webhook headers');
      return;
    }

    // 1. Identify Referral Code
    let referralCode: string | null = null;

    // A. Check Discount Codes (Priority 1)
    if (order.discount_codes && order.discount_codes.length > 0) {
      for (const discount of order.discount_codes) {
        // Assume format "REF-XXXXXX" -> extract XXXXXX
        // Or if your system uses pure codes, just match directly.
        // Let's try matching known codes in DB to be safe
        // Simply try using the code directly first.
        let potentialCode = discount.code;

        // Improve: You probably want to strip "REF-" prefix if that's how you generate them
        if (potentialCode && potentialCode.startsWith('REF-')) {
          potentialCode = potentialCode.replace('REF-', '');
        }

        referralCode = potentialCode;

        // Break after first potential code found (or handle multiple? usually 1 referrer)
        if (referralCode) break;
      }
    }

    // B. Check Note Attributes (Priority 2 - if no discount used)
    if (!referralCode && order.note_attributes) {
      const refAttr = order.note_attributes.find((attr: any) => attr.name === 'ref' || attr.name === 'referral_code');
      if (refAttr) {
        referralCode = refAttr.value;
      }
    }

    if (!referralCode) {
      this.logger.log(`No referral code found for Order ${order.id}. Skipping.`);
      return;
    }

    this.logger.log(`Found Referral Code: ${referralCode} for Order ${order.id}. Processing Reward...`);

    // 2. Validate Code & Get Campaign Info (Include Eligibility Settings)
    const codeRes = await this.db.query(
      `SELECT rc.merchant_id, rc.campaign_id, rc.referrer_id, r.shopify_customer_id as referrer_customer_id,
                c.eligible_type, c.eligible_ids
         FROM referral_codes rc
         LEFT JOIN referrers r ON rc.referrer_id = r.id
         JOIN campaigns c ON rc.campaign_id = c.id
         WHERE rc.code = $1`,
      [referralCode]
    );

    if (codeRes.rows.length === 0) {
      this.logger.warn(`Referral Code ${referralCode} not found in DB.`);
      return;
    }

    const { merchant_id, campaign_id, referrer_customer_id, eligible_type, eligible_ids } = codeRes.rows[0];

    // 3. Edge Case: Self-Referral Prevention
    if (order.customer && order.customer.id && referrer_customer_id) {
      const buyerId = String(order.customer.id);
      if (buyerId === String(referrer_customer_id)) {
        this.logger.warn(`Self-referral detected. Buyer ${buyerId} matches Referrer. Denying reward.`);
        return;
      }
    }

    // 4. CHECK ELIGIBILITY (Collection / Product)
    const checkResult = await this.productsService.checkEligibility(
      merchant_id,
      order.line_items || [],
      eligible_type || 'all',
      eligible_ids || []
    );

    if (!checkResult.isEligible) {
      this.logger.log(`Order ${order.id} is NOT eligible for reward (Type: ${eligible_type})`);
      return;
    }

    this.logger.log(`Order ${order.id} is Eligible! Qualifying Amount: ${checkResult.eligibleAmount}`);

    // 5. Distribute Reward (User filtered amount)
    const result = await this.rewardsService.distributeReward({
      merchantId: merchant_id,
      campaignId: campaign_id,
      referralCode: referralCode,
      orderId: String(order.id),
      orderAmount: checkResult.eligibleAmount, // Only use the sum of eligible items
      customerId: referrer_customer_id
    });

    if (result.success) {
      this.logger.log(`Reward Distributed Successfully for Order ${order.id}`);
    } else {
      this.logger.error(`Failed to distribute reward: ${result.reason}`);
    }
  }
}
