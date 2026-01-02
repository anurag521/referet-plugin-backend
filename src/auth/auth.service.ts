import { Injectable, ConflictException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
    constructor(private readonly supabase: SupabaseService) { }

    async signupMerchant(data: { name: string; email: string; phone: string; password: string; shop_domain: string }) {
        const { email, password, shop_domain, phone } = data;

        // 1. Check if merchant already exists in DB
        const existingMerchant = await this.supabase.query(
            'SELECT * FROM merchants WHERE email = $1 OR shop_domain = $2',
            [email, shop_domain]
        );

        if (existingMerchant.rows.length > 0) {
            // Check if it's just a reinstall or a conflict
            const m = existingMerchant.rows[0];
            // If email is already set and different, mismatch
            if (m.email && m.email !== email) {
                throw new ConflictException('Email is already registered');
            }
            // If shop is already registered with a DIFFERENT email (and that email is not null)
            if (m.shop_domain === shop_domain && m.email && m.email !== email) {
                throw new ConflictException('Shop is already registered with a different email');
            }
            // If strictly same email and same shop, it's a reinstall/update (allow it)
            if (m.shop_domain === shop_domain && m.email === email) {
                // We will proceed to update (e.g. password reset or just updating details)
            }
        }

        // 2. Create User in Supabase Auth
        const { data: authUser, error: authError } = await this.supabase.getClient().auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirm for now since they are verified by Shopify access
            user_metadata: { shop_domain, phone, name: data.name }
        });

        if (authError) {
            console.error('Supabase Auth Error:', authError);
            throw new InternalServerErrorException(`Auth creation failed: ${authError.message}`);
        }

        // 3. Create Merchant Record in DB
        // We assume the shop might have already been created during OAuth callback with just shop_id/domain.
        // If so, we should UPDATE. If not, we INSERT.
        // But the architecture says OAuth happens first. So we should UPDATE.

        // Let's try to UPDATE first based on shop_domain
        const updateRes = await this.supabase.query(
            `UPDATE merchants 
             SET email = $1, phone = $2, supabase_user_id = $3, status = 'active', name = $4, updated_at = NOW()
             WHERE shop_domain = $5
             RETURNING id, shop_id`,
            [email, phone, authUser.user.id, data.name, shop_domain]
        );

        if (updateRes.rows.length === 0) {
            // Fallback: If for some reason OAuth didn't create the row (e.g. dev mode), INSERT it
            // This mirrors the behavior of a fresh install if we allow it
            const insertRes = await this.supabase.query(
                `INSERT INTO merchants (shop_domain, shop_id, email, phone, supabase_user_id, status, name)
                 VALUES ($1, $2, $3, $4, $5, 'active', $6)
                 RETURNING id`,
                [shop_domain, shop_domain, email, phone, authUser.user.id, data.name] // using domain as shop_id fallback
            );
            return { merchant_id: insertRes.rows[0].id, status: 'active', user: authUser.user };
        }

        return { merchant_id: updateRes.rows[0].id, status: 'active', user: authUser.user };
    }
    async getMerchantStatus(shopDomain: string) {
        const result = await this.supabase.query(
            'SELECT id, name, email, status, phone FROM merchants WHERE shop_domain = $1',
            [shopDomain]
        );

        if (result.rows.length === 0) {
            return { status: 'not_found' };
        }

        const merchant = result.rows[0];
        // If email is null, they haven't finished signup
        if (!merchant.email) {
            return { status: 'pending_signup' };
        }

        return { ...merchant, status: 'active' };
    }

    async loginMerchant(data: { email?: string; shopDomain?: string; password: string }) {
        console.log('AuthService.loginMerchant called with:', data);
        if (!data) {
            throw new Error('Data passed to loginMerchant is undefined');
        }
        let { email, password, shopDomain } = data;

        // If shopDomain is provided but no email, lookup email
        if (!email && shopDomain) {
            const mRes = await this.supabase.query('SELECT email FROM merchants WHERE shop_domain = $1', [shopDomain]);
            if (mRes.rows.length === 0 || !mRes.rows[0].email) {
                throw new UnauthorizedException('Merchant not found for this shop');
            }
            email = mRes.rows[0].email;
        }

        if (!email) {
            throw new UnauthorizedException('Email or Shop Domain required');
        }

        const { data: authData, error } = await this.supabase.getClient().auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw new UnauthorizedException('Invalid password');
        }

        // Get merchant details
        const merchantRes = await this.supabase.query(
            'SELECT * FROM merchants WHERE email = $1',
            [email]
        );

        const merchant = merchantRes.rows.length > 0 ? merchantRes.rows[0] : null;

        return {
            session: authData.session,
            user: authData.user,
            merchant
        };
    }

    async getUserByToken(token: string) {
        const { data: { user }, error } = await this.supabase.getClient().auth.getUser(token);
        if (error || !user) {
            return null;
        }
        return user;
    }

    async signOut() {
        const { error } = await this.supabase.getClient().auth.signOut();
        if (error) {
            console.error('SignOut Error:', error);
            // We don't throw here, just log, because we still want to clear the cookie
        }
        return true;
    }
    // Helper for deterministic password
    private getShopifyPassword(shopDomain: string): string {
        // In production, use a strong KDF or HMAC. For now, a simple hash.
        const crypto = require('crypto');
        const secret = process.env.SHOPIFY_API_SECRET || 'fallback_secret';
        return crypto.createHmac('sha256', secret).update(shopDomain).digest('hex');
    }

    async loginOrSignupShopifyMerchant(shopDomain: string, email?: string, name?: string) {
        // STRICT LOGIN: Only login if Merchant already exists in DB.
        // DO NOT create new accounts automatically.
        // DO NOT generate system users if not present.

        // 1. Check if Merchant exists in DB
        const existing = await this.supabase.query('SELECT * FROM merchants WHERE shop_domain = $1', [shopDomain]);

        if (existing.rows.length === 0) {
            // Merchant must sign up first via the Signup Page
            throw new UnauthorizedException('Merchant account not found. Please complete the signup process first.');
        }

        const merchant = existing.rows[0];

        // 2. Perform Login (If possible)
        // We have a problem: We don't know the user's password if they signed up manually.
        // Options:
        // A) Return just the Merchant object (Frontend must handle "no token" or use a different auth header).
        // B) Use a "System/Shadow" session if we previously linked one (but user said "dont generate email...").

        // For now, based on "only login on basis of shop domain", we assume Identification is sufficient.
        // We will return the Merchant details. 
        // We CANNOT return a valid Supabase Session User without credentials.

        // However, to prevent Frontend crashes (which expects session object), we return a dummy or cached one?
        // Let's return null for session and let Frontend handle it, OR check if we can retrieve a session? No.

        return {
            session: null, // No Supabase Auth session available without password
            user: null,    // No Supabase User available
            merchant: merchant // Success!
        };
    }
}

