import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
    imports: [SupabaseModule],
    controllers: [SessionsController],
    providers: [SessionsService],
    exports: [SessionsService],
})
export class SessionsModule { }
