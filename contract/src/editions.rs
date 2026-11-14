use crate::{get, put, stats, tile_key, Press, PressExt, Tile, BASE_PLATE};
use near_contract_standards::non_fungible_token::{
    core::{NonFungibleTokenCore, NonFungibleTokenResolver},
    enumeration::NonFungibleTokenEnumeration,
    metadata::{
        NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
    },
    Token, TokenId,
};
use near_sdk::{env, json_types::U128, near, require, AccountId, PromiseOrValue};
use serde_json::json;
use std::collections::{BTreeMap, HashMap};

#[near]
impl Press {
    #[payable]
    pub fn pull_edition(&mut self, revision: u64) -> Token {
        let prints = stats().prints;
        require!(
            prints > 0 && prints == revision,
            "The mural changed. Refresh to collect the current print"
        );
        require!(
            get::<u64>("last-edition") != Some(prints),
            "This version already has an edition"
        );
        let collector = env::predecessor_account_id();
        let balance = self.ink.accounts.get(&collector).unwrap_or(0);
        require!(balance >= 4, "An edition costs 4 ink");
        let mut pixels = BASE_PLATE.concat().into_bytes();
        let mut counts = BTreeMap::<String, u16>::new();
        for i in 0..256u16 {
            if let Some(tile) = get::<Tile>(&tile_key(i)) {
                pixels[usize::from(i)] = b'0' + tile.color;
                let id: AccountId = tile.owner.parse().unwrap();
                if self.ink.accounts.contains_key(&id) {
                    *counts.entry(tile.owner).or_default() += 1;
                }
            }
        }
        let mut artists: Vec<_> = counts.into_iter().collect();
        artists.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        artists.truncate(4);
        require!(!artists.is_empty(), "Print a tile first");

        let mut payouts = BTreeMap::new();
        for i in 0..4 {
            let artist = &artists[i % artists.len()].0;
            *payouts.entry(artist.clone()).or_insert(0u64) += 1;
        }
        for (id, amount) in &payouts {
            let artist: AccountId = id.parse().unwrap();
            if artist != collector {
                self.ink.internal_transfer(
                    &collector,
                    &artist,
                    *amount as u128,
                    Some("Edition artist payment".into()),
                );
            }
        }
        let serial = get::<u64>("edition").unwrap_or(0) + 1;
        put("edition", &serial);
        put("last-edition", &prints);
        let pixels = String::from_utf8(pixels).unwrap();
        let extra=json!({"pixels":pixels,"revision":prints,"payouts":payouts,"collector":collector,"palette_version":1}).to_string();
        let metadata=TokenMetadata{
            title:Some(format!("FrogPress edition #{serial}")),
            description:Some(format!("The shared 16 by 16 mural after print {prints}. Four ink paid to its contributors.")),
            media:Some(format!("https://frogpress-near.vercel.app/api/edition?id={serial}")),
            copies:Some(1),issued_at:Some((env::block_timestamp()/1_000_000).to_string()),
            extra:Some(extra),..Default::default()
        };
        self.tokens
            .internal_mint(serial.to_string(), collector, Some(metadata))
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Press {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "FrogPress Editions".into(),
            symbol: "PRESS".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }
}
#[near]
impl NonFungibleTokenCore for Press {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        self.tokens
            .nft_transfer(receiver_id, token_id, approval_id, memo);
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.tokens
            .nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for Press {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(
            previous_owner_id,
            receiver_id,
            token_id,
            approved_account_ids,
        )
    }
}

#[near]
impl NonFungibleTokenEnumeration for Press {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, limit)
    }
}
