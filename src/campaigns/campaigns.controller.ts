import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, BadRequestException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('api/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) { }

  @Post()
  create(@Body() createCampaignDto: CreateCampaignDto, @Query('shop') shop: string) {
    if (!shop) throw new BadRequestException('Shop query parameter is required');
    return this.campaignsService.create(shop, createCampaignDto);
  }

  @Get()
  findAll(@Query('shop') shop: string) {
    if (!shop) throw new BadRequestException('Shop query parameter is required');
    return this.campaignsService.findAll(shop);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateCampaignDto: CreateCampaignDto, @Query('shop') shop: string) {
    if (!shop) throw new BadRequestException('Shop query parameter is required');
    const updatedCampaign = await this.campaignsService.update(id, shop, updateCampaignDto);
    return {
      message: 'Campaign updated successfully',
      campaign: updatedCampaign,
    };
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('shop') shop: string) {
    if (!shop) throw new BadRequestException('Shop query parameter is required');
    return this.campaignsService.remove(id, shop);
  }
}