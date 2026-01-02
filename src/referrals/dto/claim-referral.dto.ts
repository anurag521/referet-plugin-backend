import { IsNotEmpty, IsString } from 'class-validator';

export class ClaimReferralDto {
    @IsNotEmpty()
    @IsString()
    code: string;

    @IsNotEmpty()
    @IsString()
    customer_id: string; // The Shopify Customer ID
}
