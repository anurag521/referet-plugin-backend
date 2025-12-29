import { Controller, Post, Body, Res, HttpStatus, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('merchant/signup')
    async signup(@Body() body: any, @Res() res: any) {
        try {
            const result = await this.authService.signupMerchant(body);
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

    @Post('login')
    async login(@Body() body: any, @Res() res: any) {
        console.log('Login Endpoint Hit');
        console.log('Body:', body);
        console.log('Type of Body:', typeof body);
        try {
            if (!body) {
                throw new Error('Body is undefined');
            }
            const result = await this.authService.loginMerchant(body);
            return res.status(HttpStatus.OK).json(result);
        } catch (error) {
            let status = HttpStatus.INTERNAL_SERVER_ERROR;
            if (error.status) status = error.status;

            return res.status(status).json({
                message: error.message || 'Login failed',
            });
        }
    }

    @Get('status')
    async getStatus(@Query('shop') shop: string, @Res() res: any) {
        if (!shop) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Missing shop query parameter' });
        }
        try {
            const status = await this.authService.getMerchantStatus(shop);
            return res.status(HttpStatus.OK).json(status);
        } catch (error) {
            console.error('Get Status Error:', error);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to check status' });
        }
    }
}
