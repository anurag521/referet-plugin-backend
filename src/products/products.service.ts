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

            // --- 3. Sync Collections ---
            console.log(`[Sync] Starting Collection Sync...`);
            const customCols = await this.shopifyService.fetchCustomCollections(shopDomain, accessToken);
            const smartCols = await this.shopifyService.fetchSmartCollections(shopDomain, accessToken);
            const allCols = [...customCols, ...smartCols];

            console.log(`[Sync] Fetched ${allCols.length} collections (Custom: ${customCols.length}, Smart: ${smartCols.length})`);

            for (const col of allCols) {
                const colId = col.id.toString().replace('gid://shopify/Collection/', '');
                await this.db.query(
                    `INSERT INTO collections (merchant_id, shopify_collection_id, title, handle, updated_at)
                     VALUES ($1, $2, $3, $4, NOW())
                     ON CONFLICT (merchant_id, shopify_collection_id) 
                     DO UPDATE SET title = $3, handle = $4, updated_at = NOW()`,
                    [merchantId, colId, col.title, col.handle]
                );
            }

            // --- 4. Sync Product-Collection Links (Collects) ---
            // Note: 'Collects' api usually only returns links for Custom Collections. 
            // Smart collections are rule-based. For now, we sync what we can gets via 'collects'.
            // If we need smart collection product links, we might need to fetch `products.json?collection_id=...` which is heavier.
            // Let's stick to 'collects' endpoint first as it's lighter for Custom Collections.
            console.log(`[Sync] Fetching Collects...`);
            const collects = await this.shopifyService.fetchCollects(shopDomain, accessToken);
            console.log(`[Sync] Fetched ${collects.length} collection links.`);

            for (const collect of collects) {
                const prodId = collect.product_id.toString();
                const colId = collect.collection_id.toString();

                // We need internal UUIDs for product_collections table
                // This requires a lookup. To make it fast, we can try subqueries or Just-In-Time resolution.
                // Or better, let's just use the Shopify IDs if we store them? 
                // Wait, our product_collections uses REFERENCES products(id) (UUID).
                // So we MUST resolve UUIDs.

                // FASTEST WAY: Subquery INSERT
                await this.db.query(`
                    INSERT INTO product_collections (product_id, collection_id)
                    SELECT p.id, c.id
                    FROM products p, collections c
                    WHERE p.merchant_id = $1 AND p.shopify_product_id = $2
                      AND c.merchant_id = $1 AND c.shopify_collection_id = $3
                    ON CONFLICT (product_id, collection_id) DO NOTHING
                `, [merchantId, prodId, colId]);
            }
            console.log(`[Sync] Collection Sync Complete.`);

            return { success: true, created, skipped, total_fetched: products.length, total_collections: allCols.length };
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


    async checkEligibility(merchantId: string, lineItems: any[], eligibleType: string, eligibleIds: string[]) {
        if (!eligibleType || eligibleType === 'all') {
            return {
                isEligible: true,
                eligibleAmount: lineItems.reduce((sum, item) => sum + parseFloat(item.price), 0),
                eligibleItems: lineItems.map(i => i.product_id)
            };
        }

        const productIds = lineItems.map(i => i.product_id.toString()); // Ensure string

        if (eligibleType === 'product') {
            // Check intersection
            // eligibleIds are Shopify Product IDs (numeric strings)
            const eligibleSet = new Set(eligibleIds);
            const validItems = lineItems.filter(i => eligibleSet.has(i.product_id.toString()));

            return {
                isEligible: validItems.length > 0,
                eligibleAmount: validItems.reduce((sum, item) => sum + parseFloat(item.price), 0),
                eligibleItems: validItems.map(i => i.product_id)
            };
        }

        if (eligibleType === 'collection') {
            // Query DB to see which of these products are in the eligible collections
            // eligibleIds are Shopify Collection IDs (numeric strings)

            // We need to query product_collections.
            // But first, we need the internal UUIDs for the products and collections? 
            // Or we just rely on the fact that we might store Shopify IDs in a way...
            // Actually, product_collections links UUIDs.
            // So we need to resolve Shopify Product IDs -> UUIDs, and Shopify Collection IDs -> UUIDs.

            if (productIds.length === 0) return { isEligible: false, eligibleAmount: 0, eligibleItems: [] };

            const res = await this.db.query(`
                SELECT p.shopify_product_id
                FROM products p
                JOIN product_collections pc ON p.id = pc.product_id
                JOIN collections c ON pc.collection_id = c.id
                WHERE p.merchant_id = $1
                  AND p.shopify_product_id = ANY($2)
                  AND c.shopify_collection_id = ANY($3)
            `, [merchantId, productIds, eligibleIds]);

            const validProductIds = new Set(res.rows.map(r => r.shopify_product_id));
            const validItems = lineItems.filter(i => validProductIds.has(i.product_id.toString()));

            return {
                isEligible: validItems.length > 0,
                eligibleAmount: validItems.reduce((sum, item) => sum + parseFloat(item.price), 0),
                eligibleItems: validItems.map(i => i.product_id)
            };
        }

        return { isEligible: false, eligibleAmount: 0, eligibleItems: [] };
    }

    async findAllCollections(shopDomain?: string, merchantId?: string) {
        let resolvedMerchantId = merchantId;

        if (!resolvedMerchantId && shopDomain) {
            const merchantRes = await this.db.query(`SELECT id FROM merchants WHERE shop_domain = $1`, [shopDomain]);
            if (merchantRes.rows.length === 0) return [];
            resolvedMerchantId = merchantRes.rows[0].id;
        }

        if (!resolvedMerchantId) return [];

        const res = await this.db.query(
            `SELECT * FROM collections WHERE merchant_id = $1 ORDER BY title ASC`,
            [resolvedMerchantId]
        );
        return res.rows;
    }
}
