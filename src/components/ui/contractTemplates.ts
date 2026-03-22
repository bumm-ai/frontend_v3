// Contract codes for different types
export const contractCodes = {
  token: `use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::{types::DataV2},
        CreateMetadataAccountsV3
    },
    token::{Mint, Token},
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod token_creator {
    use super::*;

    // This instruction creates the token's Mint Account and its metadata
    pub fn create_token(
        ctx: Context<CreateToken>,
        decimals: u8,
        token_name: String,
        token_symbol: String,
        token_uri: String,
    ) -> Result<()> {
        // Set the mint account decimals
        // This is done automatically by Anchor when initializing the mint account

        // Now, create the metadata for the token
        let cpi_context = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint_account.to_account_info(),
                mint_authority: ctx.accounts.payer.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        );

        let data_v2 = DataV2 {
            name: token_name,
            symbol: token_symbol,
            uri: token_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(cpi_context, data_v2, false, true, None)?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(decimals: u8)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // The Mint account being created
    #[account(
        init,
        payer = payer,
        mint::decimals = decimals,
        mint::authority = payer.key(),
    )]
    pub mint_account: Account<'info, Mint>,

    /// CHECK: This is safe because we are creating it via CPI
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint_account.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata_account: UncheckedAccount<'info>,
    
    // Required Programs
    pub token_program: Program<'info, Token>,
    /// CHECK: Metaplex program address
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}`,

  nft: `use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{create_metadata_accounts_v3, create_master_edition_v3, CreateMetadataAccountsV3, CreateMasterEditionV3},
    token::{Mint, Token, TokenAccount},
};
use mpl_token_metadata::types::DataV2;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod nft_minter {
    use super::*;

    pub fn mint_nft(ctx: Context<MintNft>, name: String, symbol: String, uri: String) -> Result<()> {
        // Create the metadata account
        let cpi_context_metadata = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.payer.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        );

        let data_v2 = DataV2 { name, symbol, uri, seller_fee_basis_points: 0, creators: None, collection: None, uses: None };
        create_metadata_accounts_v3(cpi_context_metadata, data_v2, false, true, None)?;
        
        // Create the master edition account
        let cpi_context_edition = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMasterEditionV3 {
                edition: ctx.accounts.master_edition_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                update_authority: ctx.accounts.payer.to_account_info(),
                mint_authority: ctx.accounts.payer.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                metadata: ctx.accounts.metadata_account.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        );
        
        create_master_edition_v3(cpi_context_edition, Some(0))?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(init, payer = payer, mint::decimals = 0, mint::authority = payer, mint::freeze_authority = payer)]
    pub mint: Account<'info, Mint>,

    #[account(init_if_needed, payer = payer, associated_token::mint = mint, associated_token::authority = payer)]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: Safe, created via CPI
    #[account(mut, seeds = [b"metadata", token_metadata_program.key().as_ref(), mint.key().as_ref()], bump, seeds::program = token_metadata_program.key())]
    pub metadata_account: UncheckedAccount<'info>,
    
    /// CHECK: Safe, created via CPI
    #[account(mut, seeds = [b"metadata", token_metadata_program.key().as_ref(), mint.key().as_ref(), b"edition"], bump, seeds::program = token_metadata_program.key())]
    pub master_edition_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    /// CHECK: Metaplex program address
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}`,

  defi: `use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, Mint, Token, TokenAccount, Transfer
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod staking {
    use super::*;

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        // Transfer user's tokens to the vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(), 
                cpi_accounts
            ), 
            amount
        )?;
        
        // Record the staked amount
        let stake_info = &mut ctx.accounts.stake_info;
        stake_info.staked_amount = stake_info
            .staked_amount
            .checked_add(amount)
            .unwrap();
        stake_info.user = ctx.accounts.user.key();
        
        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let stake_info = &ctx.accounts.stake_info;
        let amount = stake_info.staked_amount;
        
        // Transfer tokens from the vault back to the user
        let seeds = &[
            b"vault".as_ref(), 
            ctx.accounts.stake_token_mint
                .to_account_info()
                .key
                .as_ref(), 
            &[ctx.bumps.vault_account]
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_account.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(), 
                cpi_accounts, 
                signer
            ), 
            amount
        )?;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub stake_token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed, 
        payer = user, 
        space = 8 + 8 + 32, 
        seeds = [b"stake_info", user.key().as_ref()], 
        bump
    )]
    pub stake_info: Account<'info, StakeInfo>,

    #[account(
        mut, 
        associated_token::mint = stake_token_mint, 
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut, 
        seeds = [b"vault", stake_token_mint.key().as_ref()], 
        bump
    )]
    pub vault_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub stake_token_mint: Account<'info, Mint>,
    #[account(
        init, 
        payer = admin, 
        token::mint = stake_token_mint, 
        token::authority = vault_account, 
        seeds = [b"vault", stake_token_mint.key().as_ref()], 
        bump
    )]
    pub vault_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub stake_token_mint: Account<'info, Mint>,

    #[account(
        mut, 
        close = user, 
        seeds = [b"stake_info", user.key().as_ref()], 
        bump, 
        has_one = user
    )]
    pub stake_info: Account<'info, StakeInfo>,

    #[account(
        mut, 
        associated_token::mint = stake_token_mint, 
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut, 
        seeds = [b"vault", stake_token_mint.key().as_ref()], 
        bump
    )]
    pub vault_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct StakeInfo {
    pub staked_amount: u64,
    pub user: Pubkey,
}`,

  gaming: `use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod game {
    use super::*;

    pub fn create_player(ctx: Context<CreatePlayer>, name: String) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        player.name = name;
        player.level = 1;
        player.experience = 0;
        player.authority = ctx.accounts.user.key();
        Ok(())
    }

    pub fn level_up(ctx: Context<LevelUp>) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        // In a real game, you would check for experience points here
        // For simplicity, we just increment the level
        player.level = player.level.checked_add(1).unwrap();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreatePlayer<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(init, payer = user, space = 8 + 32 + 32 + 1 + 8, seeds = [b"player", user.key().as_ref()], bump)]
    pub player_account: Account<'info, PlayerAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LevelUp<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    // The player account must be owned by the user signing the transaction
    #[account(mut, seeds = [b"player", user.key().as_ref()], bump, has_one = authority)]
    pub player_account: Account<'info, PlayerAccount>,
    pub authority: Signer<'info>,
}

#[account]
pub struct PlayerAccount {
    pub authority: Pubkey,
    pub name: String,
    pub level: u8,
    pub experience: u64,
}`,

  dao: `use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod dao {
    use super::*;

    pub fn create_proposal(ctx: Context<CreateProposal>, description: String) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        proposal.description = description;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.creator = ctx.accounts.creator.key();
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, vote_type: VoteType) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        match vote_type {
            VoteType::Yes => proposal.yes_votes = proposal.yes_votes.checked_add(1).unwrap(),
            VoteType::No => proposal.no_votes = proposal.no_votes.checked_add(1).unwrap(),
        }
        
        let vote_receipt = &mut ctx.accounts.vote_receipt;
        vote_receipt.voter = ctx.accounts.voter.key();
        vote_receipt.proposal = proposal.key();

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(init, payer = creator, space = 8 + 256 + 8 + 8 + 32)] // Space for description, votes, creator
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    
    // This receipt ensures a user can't vote twice for the same proposal
    #[account(init, payer = voter, space = 8 + 32 + 32, seeds = [b"vote", proposal.key().as_ref(), voter.key().as_ref()], bump)]
    pub vote_receipt: Account<'info, VoteReceipt>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Proposal {
    pub description: String,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub creator: Pubkey,
}

#[account]
pub struct VoteReceipt {
    pub proposal: Pubkey,
    pub voter: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum VoteType {
    Yes,
    No,
}`,

  dex: `use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer, Burn},
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Placeholder

const LP_TOKEN_DECIMALS: u8 = 9;

#[program]
pub mod simple_dex {
    use super::*;

    // Initializes a new liquidity pool
    pub fn initialize_pool(ctx: Context<InitializePool>, fee_basis_points: u16) -> Result<()> {
        let pool = &mut ctx.accounts.pool_state;
        pool.token_a_mint = ctx.accounts.token_a_mint.key();
        pool.token_b_mint = ctx.accounts.token_b_mint.key();
        pool.lp_token_mint = ctx.accounts.lp_token_mint.key();
        pool.vault_a = ctx.accounts.vault_a.key();
        pool.vault_b = ctx.accounts.vault_b.key();
        pool.fee_basis_points = fee_basis_points;

        Ok(())
    }

    // Adds liquidity to the pool
    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
        // Simple liquidity calculation (less robust than production DEXs)
        let total_lp_supply = ctx.accounts.lp_token_mint.supply;
        let lp_to_mint = if total_lp_supply == 0 {
            // First liquidity provider
            1_000_000_000 // Mint 1 LP token (assuming 9 decimals)
        } else {
            // Subsequent provider, calculate based on one side of the pool
            (amount_a * total_lp_supply) / ctx.accounts.vault_a.amount
        };

        // Transfer tokens from user to vaults
        token::transfer(ctx.accounts.transfer_a_context(), amount_a)?;
        token::transfer(ctx.accounts.transfer_b_context(), amount_b)?;
        
        // Mint LP tokens to the user
        token::mint_to(ctx.accounts.mint_lp_context(), lp_to_mint)?;

        Ok(())
    }

    // Swaps token A for token B
    pub fn swap(ctx: Context<Swap>, amount_in: u64) -> Result<()> {
        let vault_a = &ctx.accounts.vault_a;
        let vault_b = &ctx.accounts.vault_b;
        let pool = &ctx.accounts.pool_state;

        // Constant product formula: x * y = k
        let k = (vault_a.amount as u128) * (vault_b.amount as u128);
        
        // Calculate amount_out based on the formula, including fees
        let new_vault_a_amount = vault_a.amount.checked_add(amount_in).unwrap();
        let new_vault_b_amount = k.checked_div(new_vault_a_amount as u128).unwrap();
        let amount_out_gross = vault_b.amount.checked_sub(new_vault_b_amount as u64).unwrap();
        
        let fee = (amount_out_gross as u128 * pool.fee_basis_points as u128) / 10000;
        let amount_out = amount_out_gross.checked_sub(fee as u64).unwrap();

        // Transfer token_a from user to vault_a
        token::transfer(ctx.accounts.transfer_in_context(), amount_in)?;
        
        // Transfer token_b from vault_b to user
        token::transfer(ctx.accounts.transfer_out_context(), amount_out)?;

        Ok(())
    }
}

// --- Account Structures ---

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 32 + 32 + 32 + 2,
        seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        init,
        payer = admin,
        mint::decimals = LP_TOKEN_DECIMALS,
        mint::authority = pool_state,
        seeds = [b"lp_mint", pool_state.key().as_ref()],
        bump
    )]
    pub lp_token_mint: Account<'info, Mint>,

    #[account(init, payer = admin, token::mint = token_a_mint, token::authority = pool_state)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(init, payer = admin, token::mint = token_b_mint, token::authority = pool_state)]
    pub vault_b: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"pool", pool_state.token_a_mint.as_ref(), pool_state.token_b_mint.as_ref()], bump)]
    pub pool_state: Account<'info, PoolState>,
    #[account(mut, address = pool_state.lp_token_mint)]
    pub lp_token_mint: Account<'info, Mint>,
    #[account(mut, address = pool_state.vault_a)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(mut, address = pool_state.vault_b)]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = pool_state.token_a_mint, associated_token::authority = user)]
    pub user_token_a_account: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = pool_state.token_b_mint, associated_token::authority = user)]
    pub user_token_b_account: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = user, associated_token::mint = lp_token_mint, associated_token::authority = user)]
    pub user_lp_token_account: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> AddLiquidity<'info> {
    pub fn transfer_a_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_token_a_account.to_account_info(),
                to: self.vault_a.to_account_info(),
                authority: self.user.to_account_info(),
            },
        )
    }
    pub fn transfer_b_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_token_b_account.to_account_info(),
                to: self.vault_b.to_account_info(),
                authority: self.user.to_account_info(),
            },
        )
    }
    pub fn mint_lp_context(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            MintTo {
                mint: self.lp_token_mint.to_account_info(),
                to: self.user_lp_token_account.to_account_info(),
                authority: self.pool_state.to_account_info(),
            },
        )
    }
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"pool", pool_state.token_a_mint.as_ref(), pool_state.token_b_mint.as_ref()], bump)]
    pub pool_state: Account<'info, PoolState>,
    #[account(mut, address = pool_state.vault_a)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(mut, address = pool_state.vault_b)]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = pool_state.token_a_mint, associated_token::authority = user)]
    pub user_token_a_account: Account<'info, TokenAccount>, // Token to swap from
    #[account(mut, associated_token::mint = pool_state.token_b_mint, associated_token::authority = user)]
    pub user_token_b_account: Account<'info, TokenAccount>, // Token to swap to
    pub token_program: Program<'info, Token>,
}

impl<'info> Swap<'info> {
    pub fn transfer_in_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_token_a_account.to_account_info(),
                to: self.vault_a.to_account_info(),
                authority: self.user.to_account_info(),
            },
        )
    }
    pub fn transfer_out_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let seeds = &[
            b"pool",
            self.pool_state.token_a_mint.as_ref(),
            self.pool_state.token_b_mint.as_ref(),
            &[self.pool_state.bump],
        ];
        let signer = &[&seeds[..]];

        CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            Transfer {
                from: self.vault_b.to_account_info(),
                to: self.user_token_b_account.to_account_info(),
                authority: self.pool_state.to_account_info(),
            },
            signer
        )
    }
}

#[account]
pub struct PoolState {
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub lp_token_mint: Pubkey,
    pub vault_a: Pubkey,
    pub vault_b: Pubkey,
    pub fee_basis_points: u16, // e.g., 30 for 0.30%
    pub bump: u8,
}`
};

// Function to determine contract type based on context
export const getContractType = (context?: string): string => {
  if (!context) return 'defi';
  
  const lowerContext = context.toLowerCase();
  
  if (lowerContext.includes('token') || lowerContext.includes('tokens')) return 'token';
  if (lowerContext.includes('nft')) return 'nft';
  if (lowerContext.includes('defi') || lowerContext.includes('defi')) return 'defi';
  if (lowerContext.includes('gaming') || lowerContext.includes('game')) return 'gaming';
  if (lowerContext.includes('dao')) return 'dao';
  if (lowerContext.includes('dex')) return 'dex';
  
  return 'defi'; // Default DeFi
};
