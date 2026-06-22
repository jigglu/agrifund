use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};
use anchor_spl::metadata::{create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata};
use anchor_spl::metadata::mpl_token_metadata::types::DataV2;

declare_id!("9RVR31qnjswGMc4fYHpdNK5xxUsN2oxf5YfUB6ErxP7B");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PoolStatus {
    Open,
    Farming,
    Settled,
    Defaulted,
}


// ─────────────────────────────────────────────────────────────────────────────
// Account space constant
//   8   discriminator
//   32  authority (Pubkey)
//   36  crop_name (String, 4 chars len + 32 max chars)
//   1   vault_bump (u8)
//   8   total_yield_kg (u64)
//   8   price_per_kg (u64)
//   8   total_funded_usdc (u64)
//   1   is_active (bool)
// ─────────────────────────────────────────────────────────────────────────────
const YIELD_POOL_SPACE: usize = 250 + 1 + 8 + 8 + 32; // 299 bytes

// ─────────────────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────────────────
#[program]
pub mod agrifund {
    use super::*;

    /// Initialise a new YieldPool.
    ///
    /// * `crop_name`       - name of the crop
    /// * `total_yield_kg`  – total agricultural yield represented (in kg)
    /// * `price_per_kg`    – price in micro-USDC per kg (e.g. 1_000_000 = $1)
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        estate_name: String,
        crop_name: String,
        category: String,
        total_yield_kg: u64,
        price_per_kg: u64,
    ) -> Result<()> {
        require!(crop_name.len() <= 32, ErrorCode::CropNameTooLong);

        let pool = &mut ctx.accounts.yield_pool;

        pool.authority         = ctx.accounts.authority.key();
        pool.estate_name       = estate_name;
        pool.crop_name         = crop_name;
        pool.category          = category;
        pool.vault_bump        = ctx.bumps.pool_token_vault;
        pool.total_yield_kg    = total_yield_kg;
        pool.price_per_kg      = price_per_kg;
        pool.total_funded_usdc = 0;
        pool.is_active         = true;
        pool.status            = PoolStatus::Open;
        pool.farming_start_time = 0;
        pool.amount_withdrawn  = 0;
        pool.receipt_mint      = ctx.accounts.receipt_mint.key();

        msg!(
            "YieldPool initialised: authority={}, estate={}, crop={}, category={}, yield_kg={}, price_per_kg={}",
            pool.authority,
            pool.estate_name,
            pool.crop_name,
            pool.category,
            pool.total_yield_kg,
            pool.price_per_kg
        );

        // CPI to Metaplex Token Metadata program to create metadata for receipt_mint
        let cpi_program = ctx.accounts.token_metadata_program.to_account_info();
        let cpi_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.receipt_mint.to_account_info(),
            mint_authority: ctx.accounts.receipt_mint.to_account_info(),
            payer: ctx.accounts.authority.to_account_info(),
            update_authority: ctx.accounts.receipt_mint.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        let pool_key = pool.key();
        let seeds = &[
            b"receipt_mint",
            pool_key.as_ref(),
            &[ctx.bumps.receipt_mint],
        ];
        let signer_seeds = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        // Name: "agri" + category + " Token" (capped at 32 chars)
        let token_name = format!("agri{} Token", pool.category);
        
        // Symbol: "agri" + category (first 4 letters, capitalized)
        let clean_category: String = pool.category
            .chars()
            .filter(|c| c.is_alphabetic())
            .collect::<String>()
            .chars()
            .take(4)
            .collect::<String>()
            .to_uppercase();
        let token_symbol = format!("agri{}", clean_category);

        let data = DataV2 {
            name: token_name,
            symbol: token_symbol,
            uri: "".to_string(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(cpi_ctx, data, true, true, None)?;

        Ok(())
    }

    /// Fund the pool with USDC (real SPL Token transfer).
    ///
    /// * `amount_usdc` – amount of micro-USDC being contributed
    pub fn fund_yield(ctx: Context<FundYield>, amount_usdc: u64) -> Result<()> {
        let pool = &mut ctx.accounts.yield_pool;

        // Guard: pool must be active
        require!(pool.is_active, ErrorCode::PoolClosed);

        // Derive the maximum capacity: total_yield_kg × price_per_kg (micro-USDC)
        let funding_goal = pool
            .total_yield_kg
            .checked_mul(pool.price_per_kg)
            .ok_or(ErrorCode::Overflow)?;

        // Guard: new total must not exceed the funding goal
        let new_total = pool
            .total_funded_usdc
            .checked_add(amount_usdc)
            .ok_or(ErrorCode::Overflow)?;
        require!(new_total <= funding_goal, ErrorCode::Overfunded);

        // Perform CPI transfer of USDC from investor to pool vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.investor_token_account.to_account_info(),
            to: ctx.accounts.pool_token_vault.to_account_info(),
            authority: ctx.accounts.funder.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);
        token::transfer(cpi_ctx, amount_usdc)?;

        // CPI to mint receipt tokens to investor
        let pool_key = pool.key();
        let seeds = &[
            b"receipt_mint",
            pool_key.as_ref(),
            &[ctx.bumps.receipt_mint],
        ];
        let signer_seeds = &[&seeds[..]];

        let mint_cpi_accounts = MintTo {
            mint: ctx.accounts.receipt_mint.to_account_info(),
            to: ctx.accounts.investor_receipt_account.to_account_info(),
            authority: ctx.accounts.receipt_mint.to_account_info(),
        };
        let mint_cpi_ctx = CpiContext::new_with_signer(cpi_program, mint_cpi_accounts, signer_seeds);
        token::mint_to(mint_cpi_ctx, amount_usdc)?;

        // Accumulate funded amount on-chain
        pool.total_funded_usdc = new_total;

        msg!(
            "Funded {} micro-USDC — total funded: {} / goal: {}",
            amount_usdc,
            pool.total_funded_usdc,
            funding_goal,
        );

        Ok(())
    }

    pub fn withdraw_capital(ctx: Context<WithdrawCapital>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        let funding_goal = pool
            .total_yield_kg
            .checked_mul(pool.price_per_kg)
            .ok_or(ErrorCode::Overflow)?;

        if pool.status == PoolStatus::Open {
            require!(pool.total_funded_usdc >= funding_goal, ErrorCode::GoalNotMet);
            pool.status = PoolStatus::Farming;
            pool.farming_start_time = ctx.accounts.clock.unix_timestamp;
        } else if pool.status == PoolStatus::Farming {
            // Already farming
        } else {
            return err!(ErrorCode::InvalidState);
        }

        let current_time = ctx.accounts.clock.unix_timestamp;
        let elapsed = current_time.saturating_sub(pool.farming_start_time);
        let vesting_duration: i64 = 180;

        let vested_percentage = if elapsed <= 0 {
            0.0
        } else if elapsed >= vesting_duration {
            1.0
        } else {
            elapsed as f64 / vesting_duration as f64
        };

        let total_vested_amount = (pool.total_funded_usdc as f64 * vested_percentage) as u64;
        let available_to_withdraw = total_vested_amount.saturating_sub(pool.amount_withdrawn);

        require!(amount <= available_to_withdraw, ErrorCode::VestingLocked);

        pool.amount_withdrawn = pool
            .amount_withdrawn
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        let pool_key = pool.key();
        let seeds = &[
            b"vault",
            pool_key.as_ref(),
            &[pool.vault_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_token_vault.to_account_info(),
            to: ctx.accounts.estate_token_account.to_account_info(),
            authority: ctx.accounts.pool_token_vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::transfer(cpi_ctx, amount)?;

        msg!(
            "Withdrew {} micro-USDC. Total withdrawn: {}/{}",
            amount,
            pool.amount_withdrawn,
            pool.total_funded_usdc
        );

        Ok(())
    }

    pub fn settle_pool(ctx: Context<SettlePool>, repayment_amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        require!(pool.status == PoolStatus::Farming, ErrorCode::InvalidState);

        let cpi_accounts = Transfer {
            from: ctx.accounts.estate_token_account.to_account_info(),
            to: ctx.accounts.pool_token_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, repayment_amount)?;

        pool.status = PoolStatus::Settled;

        msg!(
            "Pool settled successfully. Repaid amount: {}",
            repayment_amount
        );

        Ok(())
    }

    pub fn claim_yield(ctx: Context<ClaimYield>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        require!(
            pool.status == PoolStatus::Settled || pool.status == PoolStatus::Defaulted,
            ErrorCode::InvalidState
        );

        let receipt_balance = ctx.accounts.investor_receipt_account.amount;
        let total_receipt_supply = ctx.accounts.receipt_mint.supply;
        require!(total_receipt_supply > 0, ErrorCode::NoReceiptsSupply);

        let vault_balance = ctx.accounts.pool_token_vault.amount;
        let payout_amount = (vault_balance as u128)
            .checked_mul(receipt_balance as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(total_receipt_supply as u128)
            .ok_or(ErrorCode::Overflow)? as u64;

        let burn_accounts = Burn {
            mint: ctx.accounts.receipt_mint.to_account_info(),
            from: ctx.accounts.investor_receipt_account.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let burn_ctx = CpiContext::new(cpi_program.clone(), burn_accounts);
        token::burn(burn_ctx, receipt_balance)?;

        let pool_key = pool.key();
        let seeds = &[
            b"vault",
            pool_key.as_ref(),
            &[pool.vault_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_accounts = Transfer {
            from: ctx.accounts.pool_token_vault.to_account_info(),
            to: ctx.accounts.investor_token_account.to_account_info(),
            authority: ctx.accounts.pool_token_vault.to_account_info(),
        };
        let transfer_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer_seeds);
        token::transfer(transfer_ctx, payout_amount)?;

        msg!(
            "Yield claimed. Burned {} receipts, paid out {} micro-USDC.",
            receipt_balance,
            payout_amount
        );

        Ok(())
    }

    pub fn trigger_default(ctx: Context<TriggerDefault>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        require!(pool.status == PoolStatus::Farming, ErrorCode::InvalidState);

        pool.status = PoolStatus::Defaulted;

        msg!("Pool status defaulted by weather oracle simulation.");

        Ok(())
    }

    pub fn refund_investment(ctx: Context<RefundInvestment>, refund_amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        // State Check: Refunds are ONLY allowed before farming starts (Pool status must be Open)
        require!(pool.status == PoolStatus::Open, ErrorCode::InvalidState);

        // Math Update: Restore the pool's capacity
        pool.total_funded_usdc = pool.total_funded_usdc.checked_sub(refund_amount).unwrap();

        // Burn Receipts
        let burn_accounts = Burn {
            mint: ctx.accounts.receipt_mint.to_account_info(),
            from: ctx.accounts.investor_receipt_account.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let burn_ctx = CpiContext::new(cpi_program.clone(), burn_accounts);
        token::burn(burn_ctx, refund_amount)?;

        // Return Capital
        let pool_key = pool.key();
        let seeds = &[
            b"vault",
            pool_key.as_ref(),
            &[pool.vault_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_accounts = Transfer {
            from: ctx.accounts.pool_token_vault.to_account_info(),
            to: ctx.accounts.investor_token_account.to_account_info(),
            authority: ctx.accounts.pool_token_vault.to_account_info(),
        };
        let transfer_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer_seeds);
        token::transfer(transfer_ctx, refund_amount)?;

        msg!(
            "Refund processed: {} micro-USDC refunded to investor {}.",
            refund_amount,
            ctx.accounts.investor.key()
        );

        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account Structs
// ─────────────────────────────────────────────────────────────────────────────

/// The on-chain state for a single agricultural yield pool.
#[account]
pub struct YieldPool {
    /// The farmer / admin who created this pool.
    pub authority: Pubkey,
    /// The name of the estate (e.g., "Mendez Agro Holdings")
    pub estate_name: String,
    /// The type of crop (e.g., "Basmati Rice")
    pub crop_name: String,
    /// The crop category (e.g., "Grains")
    pub category: String,
    /// The bump seed used to derive the PDA token vault
    pub vault_bump: u8,
    /// Total yield represented by this pool, in kilograms.
    pub total_yield_kg: u64,
    /// Price per kg in micro-USDC (1 USDC = 1_000_000 units).
    pub price_per_kg: u64,
    /// Cumulative USDC funded into the pool (in micro-USDC).
    pub total_funded_usdc: u64,
    /// Whether the pool is still accepting funds.
    pub is_active: bool,
    /// Current status of the pool
    pub status: PoolStatus,
    /// Timestamp when farming/drawdown started
    pub farming_start_time: i64,
    /// Amount drawn down/withdrawn by estate authority
    pub amount_withdrawn: u64,
    /// Specific receipt token mint for this pool
    pub receipt_mint: Pubkey,
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexts
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(estate_name: String, crop_name: String, category: String, total_yield_kg: u64, price_per_kg: u64)]
pub struct InitializePool<'info> {
    /// The new YieldPool account to be created (PDA or keypair).
    #[account(
        init,
        payer = authority,
        space = YIELD_POOL_SPACE
    )]
    pub yield_pool: Account<'info, YieldPool>,

    /// The PDA token vault for this pool.
    #[account(
        init,
        payer = authority,
        seeds = [b"vault", yield_pool.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = pool_token_vault,
    )]
    pub pool_token_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = receipt_mint, // PDA authority
        seeds = [b"receipt_mint", yield_pool.key().as_ref()],
        bump
    )]
    pub receipt_mint: Account<'info, Mint>,

    /// The SPL token mint (e.g., our test AgriUSD).
    pub token_mint: Account<'info, Mint>,

    /// CHECK: Metaplex metadata account PDA
    #[account(
        mut,
        seeds = [
            b"metadata",
            token_metadata_program.key().as_ref(),
            receipt_mint.key().as_ref()
        ],
        bump,
        seeds::program = token_metadata_program.key()
    )]
    pub metadata: AccountInfo<'info>,

    pub token_metadata_program: Program<'info, Metadata>,

    /// The signer who pays for account rent and becomes the authority.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Required by Anchor for account initialisation.
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundYield<'info> {
    /// The existing YieldPool to fund.
    #[account(mut)]
    pub yield_pool: Account<'info, YieldPool>,

    /// The investor's token account (from which funds will be drawn).
    #[account(
        mut,
        constraint = investor_token_account.owner == funder.key(),
        constraint = investor_token_account.mint == pool_token_vault.mint
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    /// The pool's token vault (into which funds will be deposited).
    #[account(
        mut,
        seeds = [b"vault", yield_pool.key().as_ref()],
        bump = yield_pool.vault_bump,
    )]
    pub pool_token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"receipt_mint", yield_pool.key().as_ref()],
        bump,
    )]
    pub receipt_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = investor_receipt_account.owner == funder.key(),
        constraint = investor_receipt_account.mint == receipt_mint.key()
    )]
    pub investor_receipt_account: Account<'info, TokenAccount>,

    /// The funder (must sign the transaction).
    #[account(mut)]
    pub funder: Signer<'info>,

    /// Required for token transfers.
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawCapital<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub pool: Account<'info, YieldPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump,
    )]
    pub pool_token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = estate_token_account.mint == pool_token_vault.mint
    )]
    pub estate_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct SettlePool<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub pool: Account<'info, YieldPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump,
    )]
    pub pool_token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = estate_token_account.mint == pool_token_vault.mint
    )]
    pub estate_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimYield<'info> {
    #[account(mut)]
    pub pool: Account<'info, YieldPool>,

    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        constraint = investor_receipt_account.owner == investor.key(),
        constraint = investor_receipt_account.mint == receipt_mint.key()
    )]
    pub investor_receipt_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = receipt_mint.key() == pool.receipt_mint
    )]
    pub receipt_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump,
    )]
    pub pool_token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key(),
        constraint = investor_token_account.mint == pool_token_vault.mint
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TriggerDefault<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub pool: Account<'info, YieldPool>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RefundInvestment<'info> {
    #[account(mut)]
    pub pool: Account<'info, YieldPool>,

    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        constraint = investor_receipt_account.owner == investor.key(),
        constraint = investor_receipt_account.mint == receipt_mint.key()
    )]
    pub investor_receipt_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = receipt_mint.key() == pool.receipt_mint
    )]
    pub receipt_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump,
    )]
    pub pool_token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = investor_token_account.owner == investor.key(),
        constraint = investor_token_account.mint == pool_token_vault.mint
    )]
    pub investor_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Codes
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    /// Returned when someone tries to fund a pool that is no longer active.
    #[msg("The yield pool is closed and no longer accepting funds.")]
    PoolClosed,

    /// Returned on u64 overflow when accumulating funded amounts.
    #[msg("Arithmetic overflow when accumulating funded USDC.")]
    Overflow,

    /// Returned when the funding amount would exceed total pool capacity.
    #[msg("Funding amount exceeds the maximum pool capacity.")]
    Overfunded,

    /// Returned if crop name string is too long.
    #[msg("Crop name exceeds 32 characters maximum.")]
    CropNameTooLong,

    /// Requested amount exceeds the currently vested available capital.
    #[msg("Requested amount exceeds the currently vested available capital.")]
    VestingLocked,

    /// The pool is not in a withdrawable state.
    #[msg("The pool is not in a withdrawable state.")]
    InvalidState,

    /// The funding goal has not been reached yet.
    #[msg("The funding goal has not been reached yet.")]
    GoalNotMet,

    /// No receipt token supply found.
    #[msg("No receipt token supply found.")]
    NoReceiptsSupply,
}
