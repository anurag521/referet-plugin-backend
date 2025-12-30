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

    async loginMerchant(data: { email: string; password: string }) {
        console.log('AuthService.loginMerchant called with:', data);
        if (!data) {
            throw new Error('Data passed to loginMerchant is undefined');
        }
        const { email, password } = data;

        const { data: authData, error } = await this.supabase.getClient().auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw new UnauthorizedException('Invalid email or password');
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
}
