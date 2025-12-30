import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsDateString, ValidateIf, IsJSON, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  SCHEDULED = 'scheduled',
}

export enum RewardType {
  CASHBACK = 'cashback',
  WALLET = 'wallet',
  REWARD_POINTS = 'reward_points',
}

export enum WhoGetsReward {
  BOTH = 'both',
  REFERRER_ONLY = 'referrer_only',
  REFEREE_ONLY = 'referee_only',
}

export enum RewardValueType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed',
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus = CampaignStatus.DRAFT;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsEnum(RewardType)
  @IsNotEmpty()
  reward_type: RewardType;

  @IsEnum(WhoGetsReward)
  @IsNotEmpty()
  who_gets_reward: WhoGetsReward;

  // Referrer Reward
  @ValidateIf(o => o.who_gets_reward !== WhoGetsReward.REFEREE_ONLY)
  @IsEnum(RewardValueType)
  referrer_reward_type?: RewardValueType;

  @ValidateIf(o => o.who_gets_reward !== WhoGetsReward.REFEREE_ONLY)
  @IsNumber()
  @Min(0)
  referrer_reward_value?: number;

  // Referee Reward
  @ValidateIf(o => o.who_gets_reward !== WhoGetsReward.REFERRER_ONLY)
  @IsEnum(RewardValueType)
  referee_reward_type?: RewardValueType;

  @ValidateIf(o => o.who_gets_reward !== WhoGetsReward.REFERRER_ONLY)
  @IsNumber()
  @Min(0)
  referee_reward_value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_order_value?: number = 0;

  @IsOptional()
  eligible_products?: any; // JSONB

  @IsOptional()
  eligible_collections?: any; // JSONB

  @IsOptional()
  @IsString()
  usage_limit?: string = 'unlimited';

  @IsOptional()
  @IsString()
  reward_issuance?: string = 'instant';

  @IsOptional()
  @IsNumber()
  reward_issuance_days?: number = 0;

  @IsOptional()
  @IsNumber()
  reward_expiry_days?: number = 365;
}
