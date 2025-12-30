import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ShopifyService } from '../shopify/shopify.service';


@Controller('webhooks')
export class WebhooksController {

  constructor(
    private readonly shopifyService: ShopifyService,
  ) { }


 
}
