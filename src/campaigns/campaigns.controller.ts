import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
    constructor(private readonly campaignsService: CampaignsService) { }

    @Post()
    create(
        @Query('shopDomain') shopDomain: string,
        @Body() createCampaignDto: any
    ) {
        if (!shopDomain) {
            return { error: 'Missing shopDomain query parameter' };
        }
        return this.campaignsService.create(createCampaignDto, shopDomain);
    }

    @Get()
    findAll(@Query('shopDomain') shopDomain: string) {
        if (!shopDomain) {
            return { error: 'Missing shopDomain query parameter' };
        }
        return this.campaignsService.findAll(shopDomain);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.campaignsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateCampaignDto: any) {
        return this.campaignsService.update(id, updateCampaignDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.campaignsService.remove(id);
    }
}
