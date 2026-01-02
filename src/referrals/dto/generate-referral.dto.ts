import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GenerateReferralDto {
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  campaign_id: string; // MANDATORY as per new requirement

  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @IsString()
  variant_id?: string;
}
