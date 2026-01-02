import { Controller, Post, Body, Res, HttpStatus, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('merchant/signup')
    async signup(@Body() body: any, @Res() res: Response) {
        try {
            const result = await this.authService.signupMerchant(body);
            // Note: Signup does not return a session, user must login manually or we auto-login (future TODO)
            return res.status(HttpStatus.CREATED).json(result);
        } catch (error) {
            console.error('Signup Error:', error);

            let status = HttpStatus.INTERNAL_SERVER_ERROR;
            if (error.status) status = error.status;
            if (error.message && error.message.includes('already registered')) status = HttpStatus.CONFLICT;

            return res.status(status).json({
                message: error.message || 'Signup failed',
            });
        }
    }

    @Post('shopify-login')
    async shopifyLogin(@Body() body: any, @Res() res: Response) {
        try {
            const { shop, email, name } = body;
            if (!shop) throw new Error('Shop domain required');

            // This now returns a real session!
            const result = await this.authService.loginOrSignupShopifyMerchant(shop, email, name);

            // Set HttpOnly Cookie (Same as normal login)
            if (result.session && (result.session as any).access_token) {
                const isProduction = process.env.NODE_ENV === 'production';
                res.cookie('access_token', (result.session as any).access_token, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: isProduction ? 'none' : 'lax',
                    path: '/',
                    maxAge: 24 * 60 * 60 * 1000
                });
            }

            return res.status(HttpStatus.OK).json({ success: true, ...result });
        } catch (error) {
            console.error('Auto Login Error:', error);
            return res.status(HttpStatus.UNAUTHORIZED).json({ message: error.message });
        }
    }

    @Post('login')
    async login(@Body() body: any, @Res() res: Response) {
        console.log('Login Endpoint Hit');
        try {
            if (!body) {
                throw new Error('Body is undefined');
            }
            const result = await this.authService.loginMerchant(body);

            // Set HttpOnly Cookie
            if (result.session && result.session.access_token) {
                // Determine if we should use secure cookies (default to false for dev/localhost)
                // For production or HTTPS tunnels (ngrok), this should likely be true.
                // But for direct localhost testing, false is required.
                const isProduction = process.env.NODE_ENV === 'production';

                res.cookie('access_token', result.session.access_token, {
                    httpOnly: true,
                    secure: true, // Always true for Shopify Embedded Apps (requires HTTPS)
                    sameSite: 'none', // Required for Iframes
                    path: '/',
                    maxAge: 24 * 60 * 60 * 1000 // 1 day
                });
            }

            return res.status(HttpStatus.OK).json(result);
        } catch (error) {
            console.error('Login Error:', error);
            let status = HttpStatus.INTERNAL_SERVER_ERROR;
            if (error.status) status = error.status;

            return res.status(status).json({
                message: error.message || 'Login failed',
            });
        }
    }

    @Post('logout')
    async logout(@Res() res: Response) {
        await this.authService.signOut();

        // Clear the cookie
        res.clearCookie('access_token', {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        });

        return res.status(HttpStatus.OK).json({ message: 'Logged out successfully' });
    }

    @Get('status')
    async getStatus(@Query('shop') shop: string, @Req() req: Request, @Res() res: Response) {
        // 1. Check for cookie
        const token = req.cookies['access_token'];
        if (!token && !shop) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Not authenticated' });
        }

        try {
            let user: any = null;
            if (token) {
                user = await this.authService.getUserByToken(token);
            }

            if (!shop) {
                // If just checking own status
                if (!user) return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid token' });
                return res.status(HttpStatus.OK).json({ user, isAuthenticated: true });
            }

            // If shop provided, check merchant status AND if user belongs to it
            const status = await this.authService.getMerchantStatus(shop);

            // If user is logged in, verify they match the merchant
            let isAuthenticated = false;
            if (user && status.email && user.email === status.email) {
                isAuthenticated = true;
            }

            return res.status(HttpStatus.OK).json({
                ...status,
                isAuthenticated,
                user: isAuthenticated ? user : null
            });

        } catch (error) {
            console.error('Get Status Error:', error);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to check status' });
        }
    }
}
