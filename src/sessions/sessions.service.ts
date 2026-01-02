import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SessionsService {
    constructor(private readonly supabase: SupabaseService) { }

    async storeSession(session: any): Promise<boolean> {
        try {
            // Upsert session
            // Session object comes from Shopify lib, usually has:
            // id, shop, state, isOnline, scope, expires, onlineAccessInfo, accessToken

            // We store the full object in 'content' JSONB column for easy reconstruction
            // And specific columns for querying

            const { id, shop, state, isOnline, scope, expires, onlineAccessInfo } = session;

            await this.supabase.query(
                `INSERT INTO sessions (id, shop, state, is_online, scope, expires, online_access_info, content)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE 
             SET shop = EXCLUDED.shop, 
                 state = EXCLUDED.state,
                 is_online = EXCLUDED.is_online,
                 scope = EXCLUDED.scope,
                 expires = EXCLUDED.expires,
                 online_access_info = EXCLUDED.online_access_info,
                 content = EXCLUDED.content`,
                [
                    id,
                    shop,
                    state,
                    isOnline,
                    scope,
                    expires ? new Date(expires).getTime() : null, // Ensure numeric timestamp if compatible or null
                    onlineAccessInfo ? JSON.stringify(onlineAccessInfo) : null,
                    JSON.stringify(session)
                ]
            );
            return true;
        } catch (error) {
            console.error('Error storing session:', error);
            throw new InternalServerErrorException('Failed to store session');
        }
    }

    async loadSession(id: string): Promise<any | undefined> {
        try {
            const res = await this.supabase.query('SELECT content FROM sessions WHERE id = $1', [id]);
            if (res.rows.length === 0) return undefined;
            // Parse the JSON content back
            const content = res.rows[0].content;
            return typeof content === 'string' ? JSON.parse(content) : content;
        } catch (error) {
            console.error('Error loading session:', error);
            // Returns undefined as per Shopify SessionStorage interface expectation for miss
            return undefined;
        }
    }

    async deleteSession(id: string): Promise<boolean> {
        try {
            await this.supabase.query('DELETE FROM sessions WHERE id = $1', [id]);
            return true;
        } catch (error) {
            console.error('Error deleting session:', error);
            // throw new InternalServerErrorException('Failed to delete session');
            return false;
        }
    }
}
