import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
    imports: [SupabaseModule, ShopifyModule],
    controllers: [ProductsController],
    providers: [ProductsService],
    exports: [ProductsService],
})
export class ProductsModule { }
