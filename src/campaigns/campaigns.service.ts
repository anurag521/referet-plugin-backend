import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly db: SupabaseService) { }

  // Helper to find or create merchant by shop domain
  async getMerchantId(shopDomain: string): Promise<string> {
    // 1. Check if merchant exists
    const res = await this.db.query(
      `SELECT id FROM merchants WHERE shop_domain = $1`,
      [shopDomain]
    );

    if (res.rows.length > 0) {
      return res.rows[0].id;
    }

    // 2. Create if not exists (minimal record)
    console.log(`Merchant not found for ${shopDomain}, creating new record...`);
    const insert = await this.db.query(
      `INSERT INTO merchants (shop_domain) VALUES ($1) RETURNING id`,
      [shopDomain]
    );
    return insert.rows[0].id;
  }

  async create(shopDomain: string, dto: CreateCampaignDto) {
    if (!shopDomain) throw new BadRequestException('Shop Domain is required');

    // 1. Resolve Merchant ID
    const merchantId = await this.getMerchantId(shopDomain);

    // 2. Validate Logic
    if (dto.start_date && dto.end_date) {
      if (new Date(dto.start_date) >= new Date(dto.end_date)) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    // 3. Insert Campaign
    const query = `
      INSERT INTO campaigns (
        merchant_id, 
        name, status, start_date, end_date, 
        reward_type, who_gets_reward, 
        referrer_reward_type, referrer_reward_value, 
        referee_reward_type, referee_reward_value, 
        min_order_value, eligible_products, eligible_collections,
        usage_limit, reward_issuance, reward_issuance_days, reward_expiry_days
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *
    `;

    const values = [
      merchantId,
      dto.name,
      dto.status || 'draft',
      dto.start_date ? new Date(dto.start_date) : null,
      dto.end_date ? new Date(dto.end_date) : null,
      dto.reward_type,
      dto.who_gets_reward,
      dto.referrer_reward_type,
      dto.referrer_reward_value,
      dto.referee_reward_type,
      dto.referee_reward_value,
      dto.min_order_value || 0,
      JSON.stringify(dto.eligible_products || ["all"]),
      JSON.stringify(dto.eligible_collections || []),
      dto.usage_limit || 'unlimited',
      dto.reward_issuance || 'instant',
      dto.reward_issuance_days || 0,
      dto.reward_expiry_days || 365
    ];

    try {
      const result = await this.db.query(query, values);
      return result.rows[0];
    } catch (e) {
      console.error('Error creating campaign:', e);
      throw new BadRequestException('Failed to create campaign');
    }
  }

  async findAll(shopDomain: string) {
    const merchantId = await this.getMerchantId(shopDomain);
    const result = await this.db.query(
      `SELECT * FROM campaigns WHERE merchant_id = $1 ORDER BY created_at DESC`,
      [merchantId]
    );
    return result.rows;
  }

  async findOne(id: string) {
    const result = await this.db.query(`SELECT * FROM campaigns WHERE id = $1`, [id]);
    return result.rows[0];
  }

  async update(id: string, shopDomain: string, dto: Partial<CreateCampaignDto>) {
    console.log(`[Update] Starting update for Campaign ${id} (Shop: ${shopDomain})`);
    console.log(`[Update] Payload:`, JSON.stringify(dto));

    const merchantId = await this.getMerchantId(shopDomain);
    console.log(`[Update] Merchant ID: ${merchantId}`);

    // 1. Check ownership
    const check = await this.db.query(`SELECT id FROM campaigns WHERE id = $1 AND merchant_id = $2`, [id, merchantId]);
    if (check.rows.length === 0) {
      console.error(`[Update] Campaign ${id} not found for Merchant ${merchantId}`);
      throw new BadRequestException('Campaign not found or access denied');
    }
    console.log(`[Update] Ownership verified.`);

    // 2. Build Dynamic Update Query
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Helper to add field if present
    const addField = (col: string, val: any) => {
      // Check for undefined specifically, allowing null if needed (though DTO usually has fields or undefined)
      if (val !== undefined) {
        updates.push(`${col} = $${idx++}`);
        values.push(val);
      }
    };

    if (dto.name) addField('name', dto.name);
    if (dto.status) addField('status', dto.status);
    if (dto.start_date) addField('start_date', new Date(dto.start_date));
    if (dto.end_date) addField('end_date', new Date(dto.end_date));
    if (dto.reward_type) addField('reward_type', dto.reward_type);
    if (dto.who_gets_reward) addField('who_gets_reward', dto.who_gets_reward);
    if (dto.referrer_reward_type) addField('referrer_reward_type', dto.referrer_reward_type);
    if (dto.referrer_reward_value !== undefined) addField('referrer_reward_value', dto.referrer_reward_value);
    if (dto.referee_reward_type) addField('referee_reward_type', dto.referee_reward_type);
    if (dto.referee_reward_value !== undefined) addField('referee_reward_value', dto.referee_reward_value);
    if (dto.min_order_value !== undefined) addField('min_order_value', dto.min_order_value);
    if (dto.eligible_products) addField('eligible_products', JSON.stringify(dto.eligible_products));
    if (dto.eligible_collections) addField('eligible_collections', JSON.stringify(dto.eligible_collections));
    if (dto.usage_limit) addField('usage_limit', dto.usage_limit);
    if (dto.reward_issuance) addField('reward_issuance', dto.reward_issuance);
    if (dto.reward_issuance_days !== undefined) addField('reward_issuance_days', dto.reward_issuance_days);
    if (dto.reward_expiry_days !== undefined) addField('reward_expiry_days', dto.reward_expiry_days);

    addField('updated_at', new Date());

    if (updates.length === 0) {
      console.log(`[Update] No fields to update.`);
      return check.rows[0]; // No changes
    }

    // Add ID and MerchantID to values for WHERE clause
    values.push(id);
    values.push(merchantId);

    const query = `
      UPDATE campaigns 
      SET ${updates.join(', ')} 
      WHERE id = $${idx} AND merchant_id = $${idx + 1}
      RETURNING *
    `;

    console.log(`[Update] Query:`, query);
    console.log(`[Update] Values:`, JSON.stringify(values));

    try {
      const result = await this.db.query(query, values);
      console.log(`[Update] Success. Updated row:`, result.rows[0]);
      return result.rows[0];
    } catch (e) {
      console.error('[Update] Database error:', e);
      throw new BadRequestException('Failed to update campaign');
    }
  }

  async remove(id: string, shopDomain: string) {
    const merchantId = await this.getMerchantId(shopDomain);
    // Validate ownership before delete
    await this.db.query(`DELETE FROM campaigns WHERE id = $1 AND merchant_id = $2`, [id, merchantId]);
    return { success: true };
  }
}
