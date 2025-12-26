import { Controller, Get, Post, Body, Query, Param, Req, Res } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ShopifyService } from '../shopify/shopify.service';

@Controller('referral')
export class ReferralController {
  constructor(
    private referralService: ReferralService,
    private shopifyService: ShopifyService,
  ) { }

  @Get('link')
  async getReferralLink(
    @Query('customerId') customerId: string,
    @Query('shopDomain') shopDomain: string,
  ) {
    console.log('Received request for customerId:', customerId);
    console.log('Shop domain:', shopDomain);

    // Fetch customer data to display name in console
    // NOTE: Requires valid SHOPIFY_ACCESS_TOKEN in environment variables
    // If token is missing/invalid, customer data won't be fetched
    let customer: any = null;

    try {
      customer = await this.shopifyService.getCustomerById(customerId, shopDomain);
      const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown';
      console.log('✅ Customer Name:', customerName);
      console.log('✅ Customer Email:', customer.email || 'N/A');
      console.log('✅ Customer ID:', customer.id);
    } catch (error) {
      console.warn('⚠️  Could not fetch customer data - Access token may be missing/invalid');
      console.warn('   Error:', error.message);
      console.log('   Customer ID:', customerId);
      console.log('   Shop Domain:', shopDomain);
      console.log('   💡 Tip: Set SHOPIFY_ACCESS_TOKEN in .env file');
    }

    let customerEmail = 'unknown@example.com';
    if (customer && customer.email) {
      customerEmail = customer.email;
    }

    // Call the new DB-backed service method
    const result = await this.referralService.generateReferralLink(
      shopDomain || process.env.SHOPIFY_SHOP || '',
      customerEmail
    );

    return {
      referralCode: result.referralCode,
      referralLink: result.referralUrl,
      customer: customer
    };
  }

  @Get('discount')
  async getDiscountCode(@Query('referralCode') referralCode: string) {
    console.log('Getting discount code for referral:', referralCode);

    if (!referralCode || !referralCode.startsWith('REF-')) {
      return { error: 'Invalid referral code' };
    }

    try {
      const discountCode = await this.shopifyService.getOrCreateDiscountForReferral(referralCode);
      return {
        discountCode: discountCode,
        referralCode: referralCode,
      };
    } catch (error) {
      console.error('Error getting discount code:', error);
      return { error: 'Failed to get discount code' };
    }
  }

  @Get('click')
  async trackClick(
    @Query('ref') referralCode: string,
    @Req() req: any,
    @Res() res: any
  ) {
    if (!referralCode) {
      return res.status(400).json({ error: 'Missing referral code' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    try {
      await this.referralService.trackClick(referralCode, ip, userAgent);

      // As per PDF: "implement a redirect response that sets a server-side cookie 
      // OR ensure the frontend script handles this"
      // Since we are an API called by frontend script, we'll return success 
      // and let frontend set localStorage/cookie or we set cookie here.
      // We will set a cookie for 30 days.
      res.cookie('referral_code', referralCode, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true, // Secure cookie? 
        // If accessing via AJAX from different domain, might need SameSite=None + Secure
        secure: true,
        sameSite: 'none'
      });

      return res.json({ status: 'tracked', referralCode });
    } catch (error) {
      console.error('Click tracking error:', error);
      return res.status(500).json({ error: 'Failed to track click' });
    }
  }

  @Get('customer/:customerId')
  async getCustomer(
    @Param('customerId') customerId: string,
    @Query('shopDomain') shopDomain?: string,
  ) {
    console.log('Getting customer data for:', customerId);

    try {
      const customer = await this.shopifyService.getCustomerById(customerId, shopDomain);
      return {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        createdAt: customer.created_at,
        ordersCount: customer.orders_count,
      };
    } catch (error) {
      console.error('Error getting customer:', error);
      return { error: 'Failed to get customer data' };
    }
  }

  @Get('customer/email/:email')
  async getCustomerByEmail(
    @Param('email') email: string,
    @Query('shopDomain') shopDomain?: string,
  ) {
    console.log('Searching customer by email:', email);

    try {
      const customer = await this.shopifyService.getCustomerByEmail(email, shopDomain);
      if (!customer) {
        return { error: 'Customer not found' };
      }

      return {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        createdAt: customer.created_at,
        ordersCount: customer.orders_count,
      };
    } catch (error) {
      console.error('Error searching customer:', error);
      return { error: 'Failed to search customer' };
    }
  }
}
