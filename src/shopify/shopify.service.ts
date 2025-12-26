// src/shopify/shopify.service.ts

import { Injectable } from '@nestjs/common';
import * as fetch from 'node-fetch';

@Injectable()
export class ShopifyService {
  private readonly SHOP = process.env.SHOPIFY_SHOP ?? '';
  private readonly TOKEN = process.env.SHOPIFY_ACCESS_TOKEN ?? '';
  private readonly API_VERSION = '2024-10';

  constructor() {
    // Debug: Log token status (without exposing full token)
    if (!this.TOKEN) {
      console.warn('⚠️  SHOPIFY_ACCESS_TOKEN is not set in environment variables');
    } else {
      console.log('✅ SHOPIFY_ACCESS_TOKEN is set (length:', this.TOKEN.length, ')');
      console.log('   Token starts with:', this.TOKEN.substring(0, 10) + '...');
    }

    if (!this.SHOP) {
      console.warn('⚠️  SHOPIFY_SHOP is not set in environment variables');
    } else {
      console.log('✅ SHOPIFY_SHOP is set:', this.SHOP);
    }
  }

  async createDiscountCode(
    discountCode: string,
    referralCode: string,
    value: number = 10,  // default 10%
    valueType: 'percentage' | 'fixed_amount' = 'percentage',
    usageLimit: number = 1
  ) {
    try {
      // Calculate string value for Shopify
      // Shopify requires negative number for discount off
      const stringValue = `-${Math.abs(value)}`;

      // Step 1: Create a price rule
      const priceRuleResponse = await fetch.default(
        `https://${this.SHOP}/admin/api/${this.API_VERSION}/price_rules.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': this.TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price_rule: {
              title: `Referral Discount - ${referralCode}`,
              target_type: 'line_item',
              target_selection: 'all',
              allocation_method: 'across',
              value_type: valueType,
              value: stringValue,
              customer_selection: 'all',
              starts_at: new Date().toISOString(),
              usage_limit: usageLimit,
            },
          }),
        },
      );

      if (!priceRuleResponse.ok) {
        const errorText = await priceRuleResponse.text();
        console.error('Failed to create price rule:', errorText);
        throw new Error(`Failed to create price rule: ${errorText}`);
      }

      const priceRuleData = await priceRuleResponse.json() as { price_rule: { id: number } };
      const priceRuleId = priceRuleData.price_rule.id;

      // Step 2: Create discount code for the price rule
      const discountResponse = await fetch.default(
        `https://${this.SHOP}/admin/api/${this.API_VERSION}/price_rules/${priceRuleId}/discount_codes.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': this.TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            discount_code: {
              code: discountCode,
            },
          }),
        },
      );

      if (!discountResponse.ok) {
        const errorText = await discountResponse.text();
        console.error('Failed to create discount code:', errorText);
        throw new Error(`Failed to create discount code: ${errorText}`);
      }

      return discountCode;
    } catch (error) {
      console.error('Error creating discount code:', error);
      throw error;
    }
  }

  async getOrCreateDiscountForReferral(referralCode: string): Promise<string> {
    // Generate a consistent discount code for this referral
    // Format: REF10-{last4chars}
    const discountCode = `REF10-${referralCode.slice(-4)}`;

    try {
      // Try to create the discount code
      await this.createDiscountCode(discountCode, referralCode);
      return discountCode;
    } catch (error) {
      // If it already exists, return it anyway
      // In production, you'd want to check if it exists first
      console.log('Discount code might already exist, returning:', discountCode);
      return discountCode;
    }
  }

  /**
   * Get customer data from Shopify Admin API
   * @param customerId - Shopify customer ID
   * @param shopDomain - Shop domain (optional, uses env if not provided)
   * @param accessToken - Access token (optional, uses env if not provided)
   */
  async getCustomerById(
    customerId: string,
    shopDomain?: string,
    accessToken?: string,
  ): Promise<any> {
    const shop = shopDomain || this.SHOP;
    const token = accessToken || this.TOKEN;

    // Debug logging
    if (!token) {
      throw new Error('Access token is required. Set SHOPIFY_ACCESS_TOKEN in .env file');
    }
    if (!shop) {
      throw new Error('Shop domain is required. Set SHOPIFY_SHOP in .env file or pass shopDomain parameter');
    }

    console.log('🔍 Fetching customer from:', shop);
    console.log('   Using token:', token.substring(0, 15) + '...');

    try {
      const response = await fetch.default(
        `https://${shop}/admin/api/${this.API_VERSION}/customers/${customerId}.json`,
        {
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to get customer from Shopify API');
        console.error('   Shop:', shop);
        console.error('   Status:', response.status);
        console.error('   Error:', errorText);

        // Provide helpful error messages
        if (response.status === 401) {
          throw new Error('Invalid access token. Please check SHOPIFY_ACCESS_TOKEN in .env file');
        } else if (response.status === 404) {
          throw new Error(`Customer ${customerId} not found in shop ${shop}`);
        }
        throw new Error(`Failed to get customer: ${errorText}`);
      }

      const data = await response.json() as { customer: any };
      console.log('🔍 Raw Shopify Response:', JSON.stringify(data, null, 2));
      return data.customer;
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }

  /**
   * Get customer by email from Shopify Admin API
   * @param email - Customer email
   * @param shopDomain - Shop domain (optional)
   * @param accessToken - Access token (optional)
   */
  async getCustomerByEmail(
    email: string,
    shopDomain?: string,
    accessToken?: string,
  ): Promise<any> {
    const shop = shopDomain || this.SHOP;
    const token = accessToken || this.TOKEN;

    try {
      const response = await fetch.default(
        `https://${shop}/admin/api/${this.API_VERSION}/customers/search.json?query=email:${encodeURIComponent(email)}`,
        {
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to search customer:', errorText);
        throw new Error(`Failed to search customer: ${errorText}`);
      }

      const data = await response.json() as { customers: any[] };
      return data.customers.length > 0 ? data.customers[0] : null;
    } catch (error) {
      console.error('Error searching customer:', error);
      throw error;
    }
  }

  /**
   * Get order details from Shopify Admin API
   * @param orderId - Shopify order ID
   * @param shopDomain - Shop domain (optional)
   * @param accessToken - Access token (optional)
   */
  async getOrderById(
    orderId: string,
    shopDomain?: string,
    accessToken?: string,
  ): Promise<any> {
    const shop = shopDomain || this.SHOP;
    const token = accessToken || this.TOKEN;

    try {
      const response = await fetch.default(
        `https://${shop}/admin/api/${this.API_VERSION}/orders/${orderId}.json`,
        {
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to get order:', errorText);
        throw new Error(`Failed to get order: ${errorText}`);
      }

      const data = await response.json() as { order: any };
      return data.order;
    } catch (error) {
      console.error('Error getting order:', error);
      throw error;
    }
  }
}
