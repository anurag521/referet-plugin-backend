import { Controller, Get, Post, Delete, Body, Param, HttpStatus, Res } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import type { Response } from 'express';

@Controller('api/sessions')
export class SessionsController {
    constructor(private readonly sessionsService: SessionsService) { }

    @Post()
    async storeSession(@Body() session: any, @Res() res: Response) {
        const saved = await this.sessionsService.storeSession(session);
        if (saved) {
            return res.status(HttpStatus.CREATED).json({ success: true });
        } else {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false });
        }
    }

    @Get(':id')
    async loadSession(@Param('id') id: string, @Res() res: Response) {
        // id might be URL encoded
        const decodedId = decodeURIComponent(id);
        const session = await this.sessionsService.loadSession(decodedId);
        if (session) {
            return res.status(HttpStatus.OK).json(session);
        } else {
            // Identify as not found (Shopify requirement: return undefined essentially, API returns null/404)
            // Frontend implementation apiCall wrapper usually expects JSON or handles error.
            // Frontend implementation in session-storage.server.ts:
            // if (raw) return new Session(raw).
            // so returning null or 404 is fine.
            return res.status(HttpStatus.NO_CONTENT).send();
        }
    }

    @Delete(':id')
    async deleteSession(@Param('id') id: string, @Res() res: Response) {
        const decodedId = decodeURIComponent(id);
        await this.sessionsService.deleteSession(decodedId);
        return res.status(HttpStatus.OK).json({ success: true });
    }
}
