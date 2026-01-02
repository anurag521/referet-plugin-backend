import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ShopifyService } from '../shopify/shopify.service';

@Injectable()
export class ProductsService {
    constructor(
        private readonly db: SupabaseService,
        private readonly shopifyService: ShopifyService,
    ) { }

    // Process Webhook for Create
    async handleWebhookCreate(shopDomain: string, payload: any) {
        const merchantRes = await this.db.query(`SELECT id FROM merchants WHERE shop_domain = $1`, [shopDomain]);
        if (merchantRes.rows.length === 0) return; // Silent fail if merchant not found
        await this.createProduct(merchantRes.rows[0].id, payload);
    }

    async syncProducts(shopDomain: string) {
        // 1. Get Merchant ID
        const merchantRes = await this.db.query(`SELECT id FROM merchants WHERE shop_domain = $1`, [shopDomain]);
        if (merchantRes.rows.length === 0) throw new BadRequestException('Merchant not found');
        const merchantId = merchantRes.rows[0].id;

        // 2. Fetch all products from Shopify
        // We assume shopifyService has a method to get a client or we use a generic fetch
        // We need the Offline Access Token for this shop. 
        console.log(`[Sync] Looking up offline session for: offline_${shopDomain}`);
        const sessionRes = await this.db.query(
            `SELECT content FROM sessions WHERE id = $1`,
            [`offline_${shopDomain}`]
        );

        let accessToken: string | undefined;

        if (sessionRes.rows.length > 0) {
            try {
                // The session content is already parsed by pg if column is JSONB, or string if text
                const rawContent = sessionRes.rows[0].content;
                const sessionProto = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
                accessToken = sessionProto.accessToken;
                console.log(`[Sync] Found access token in session (Length: ${accessToken?.length})`);
            } catch (e) {
                console.error("[Sync] Failed to parse session content", e);
            }
        } else {
            console.warn(`[Sync] No session record found in DB for offline_${shopDomain}`);
        }

        if (!accessToken) {
            console.warn(`[Sync] No offline access token found for ${shopDomain}. Check DB 'sessions' table.`);
        }

        try {
            console.log(`[Sync] Callling shopifyService.fetchAllProducts...`);
            const products = await this.shopifyService.fetchAllProducts(shopDomain, accessToken);
            console.log(`[Sync] Fetched ${products.length} products from Shopify.`);

            let created = 0;
            let skipped = 0;

            for (const p of products) {
                const saved = await this.createProduct(merchantId, p);
                if (saved) created++;
                else skipped++;
            }
            console.log(`[Sync] Sync Complete. Created: ${created}, Skipped: ${skipped}`);

            return { success: true, created, skipped, total_fetched: products.length };
        } catch (error) {
            console.error(`[Sync] Error during sync execution:`, error);
            throw error;
        }
    }

    // Method to handle a single product creation (used by Sync and Webhook)
    async createProduct(merchantId: string, p: any): Promise<boolean> {
        // CHANGED: Save only the Numeric ID (strip GID prefix)
        const shopifyId = p.id.toString().replace('gid://shopify/Product/', '');

        // Check Exists (Insert-Only)
        const existing = await this.db.query(
            `SELECT id FROM products WHERE merchant_id = $1 AND shopify_product_id = $2`,
            [merchantId, shopifyId]
        );

        if (existing.rows.length > 0) return false; // Skipped

        await this.db.query(
            `INSERT INTO products (merchant_id, shopify_product_id, title, handle, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                merchantId,
                shopifyId,
                p.title,
                p.handle,
                p.image?.src || p.images?.[0]?.src || null, // Handle different payload structures
                p.status
            ]
        );
        return true; // Created
    }

    async deleteProduct(shopDomain: string, shopifyProductId: string) {
        const merchantRes = await this.db.query(`SELECT id FROM merchants WHERE shop_domain = $1`, [shopDomain]);
        if (merchantRes.rows.length === 0) return;
        const merchantId = merchantRes.rows[0].id;

        // CHANGED: Strip GID prefix for matching
        const formattedId = shopifyProductId.toString().replace('gid://shopify/Product/', '');

        await this.db.query(
            `DELETE FROM products WHERE merchant_id = $1 AND shopify_product_id = $2`,
            [merchantId, formattedId]
        );
    }

    async findAll(shopDomain?: string, productId?: string, merchantId?: string) {
        let resolvedMerchantId = merchantId;

        if (!resolvedMerchantId && shopDomain) {
            const merchantRes = await this.db.query(`SELECT id FROM merchants WHERE shop_domain = $1`, [shopDomain]);
            if (merchantRes.rows.length === 0) return [];
            resolvedMerchantId = merchantRes.rows[0].id;
        }

        if (!resolvedMerchantId) return [];

        let query = `SELECT * FROM products WHERE merchant_id = $1`;
        const params: any[] = [resolvedMerchantId];

        if (productId) {
            const cleanId = productId.toString().replace('gid://shopify/Product/', '');
            query += ` AND shopify_product_id = $2`;
            params.push(cleanId);
        }

        query += ` ORDER BY title ASC`;

        const res = await this.db.query(query, params);
        return res.rows;
    }
}
