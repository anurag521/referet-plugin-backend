import { Controller, Post, Query, BadRequestException, Get, Body } from '@nestjs/common';
import { ProductsService } from './products.service';


@Controller('api/products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Post('sync')
    async syncProducts(@Query('shop') shop: string) {
        if (!shop) throw new BadRequestException('Shop required');
        return this.productsService.syncProducts(shop);
    }

    @Post('webhook/create')
    async handleWebhookCreate(@Query('shop') shop: string, @Body() payload: any) {
        if (!shop) throw new BadRequestException('Shop required');
        // Get merchant ID first (since createProduct expects it)
        // We'll quick-fetch it here or make createProduct smarter.
        // Let's refactor createProduct to take merchantId, so we need to fetch it.
        // Actually, let's expose a method in Service that takes Shop Domain.
        return this.productsService.handleWebhookCreate(shop, payload);
    }

    @Post('webhook/delete')
    async handleWebhookDelete(@Query('shop') shop: string, @Body() payload: any) {
        if (!shop) throw new BadRequestException('Shop required');
        // Payload for delete usually has { id: 1234 }
        return this.productsService.deleteProduct(shop, payload.id);
    }

    @Get()
    async getProducts(
        @Query('shop') shop?: string,
        @Query('product_id') productId?: string,
        @Query('merchant_id') merchantId?: string
    ) {
        if (!shop && !merchantId) throw new BadRequestException('Shop Domain OR Merchant ID required');
        return this.productsService.findAll(shop, productId, merchantId);
    }
}
