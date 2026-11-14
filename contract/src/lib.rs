//! A NEAR community print studio. The tile and profile prefixes preserve the first public deployment.
mod editions;
mod ink;
use near_contract_standards::{
    fungible_token::{
        events::{FtBurn, FtMint},
        FungibleToken,
    },
    non_fungible_token::NonFungibleToken,
    storage_management::StorageManagement,
};
use near_sdk::{
    env, json_types::U128, near, require, AccountId, NearToken, PanicOnDefault, Promise,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::collections::BTreeSet;

fn get<T: DeserializeOwned>(key: &str) -> Option<T> {
    env::storage_read(key.as_bytes()).map(|v| serde_json::from_slice(&v).unwrap())
}
fn put<T: Serialize>(key: &str, v: &T) {
    env::storage_write(key.as_bytes(), &serde_json::to_vec(v).unwrap());
}
fn stats() -> Stats {
    get("stats").unwrap_or_default()
}
fn player(id: &str) -> Player {
    get(&format!("p/{id}")).unwrap_or_default()
}
fn save(id: &str, p: &Player) {
    put(&format!("p/{id}"), p)
}
fn tile_key(i: u16) -> String {
    format!("t/{i}")
}
fn today() -> u64 {
    env::block_timestamp() / 86_400_000_000_000
}
#[derive(Default, Serialize, Deserialize)]
pub struct Player {
    balance: u64,
    last_claim: Option<u64>,
    prints: u64,
}
#[derive(Default, Serialize, Deserialize)]
struct Stats {
    minted: u64,
    burned: u64,
    prints: u64,
    players: u64,
}
#[derive(Serialize, Deserialize)]
struct Tile {
    color: u8,
    owner: String,
    revision: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Press {
    ink: FungibleToken,
    tokens: NonFungibleToken,
}
#[near]
impl Press {
    /// Only the contract account may initialize. On an upgrade, prove every existing
    /// claimant and every unit of circulating ink is represented before switching ledgers.
    #[init]
    #[private]
    pub fn initialize(previous_players: Vec<AccountId>) -> Self {
        let mut state = Self {
            ink: FungibleToken::new(b"INK".to_vec()),
            tokens: NonFungibleToken::new(
                b"NFT".to_vec(),
                env::current_account_id(),
                Some(b"META".to_vec()),
                Some(b"ENUM".to_vec()),
                None::<Vec<u8>>,
            ),
        };
        let unique: BTreeSet<_> = previous_players.into_iter().collect();
        let totals = stats();
        require!(
            unique.len() as u64 == totals.players,
            "Player count mismatch"
        );
        for id in unique {
            let p = player(id.as_str());
            require!(p.last_claim.is_some(), "Unknown legacy player");
            state.ink.internal_register_account(&id);
            state.ink.internal_deposit(&id, p.balance as u128);
        }
        require!(
            state.ink.total_supply == (totals.minted - totals.burned) as u128,
            "Supply mismatch"
        );
        state
    }
    pub fn get_board(&self) -> serde_json::Value {
        let tiles: Vec<Option<Tile>> = (0..256).map(|i| get(&tile_key(i))).collect();
        serde_json::json!({"tiles":tiles,"stats":stats(),"supply":self.ink.total_supply.to_string(),"day":today(),"plate":BASE_PLATE.concat(),"edition":get::<u64>("edition").unwrap_or(0),"collected_revision":get::<u64>("last-edition").unwrap_or(0)})
    }
    pub fn get_player(&self, account_id: AccountId) -> Player {
        let mut p = player(account_id.as_str());
        p.balance = self.ink.accounts.get(&account_id).unwrap_or(0) as u64;
        p
    }
    #[payable]
    pub fn claim(&mut self) -> Player {
        let id = env::predecessor_account_id();
        let mut p = player(id.as_str());
        let mut s = stats();
        let day = today();
        require!(p.last_claim != Some(day), "Already claimed today");
        let mut storage = 0;
        if !self.ink.accounts.contains_key(&id) {
            storage = self.ink.storage_balance_bounds().min.as_yoctonear();
            self.ink.internal_register_account(&id);
        }
        let before = env::storage_usage();
        if p.last_claim.is_none() {
            s.players += 1;
        }
        p.last_claim = Some(day);
        p.balance = 0;
        save(id.as_str(), &p);
        storage += u128::from(env::storage_usage().saturating_sub(before))
            * env::storage_byte_cost().as_yoctonear();
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= storage, "Attach storage deposit for first claim");
        if deposit > storage {
            let _refund =
                Promise::new(id.clone()).transfer(NearToken::from_yoctonear(deposit - storage));
        }
        self.ink.internal_deposit(&id, 8);
        FtMint {
            owner_id: &id,
            amount: U128(8),
            memo: Some("Daily ink"),
        }
        .emit();
        s.minted += 8;
        put("stats", &s);
        self.get_player(id)
    }
    pub fn print_tile(&mut self, index: u16, color: u8, revision: u64) -> serde_json::Value {
        require!(index < 256 && color < 6, "Invalid tile or ink");
        let key = tile_key(index);
        let old: Option<Tile> = get(&key);
        require!(
            old.as_ref().map_or(0, |t| t.revision) == revision,
            "Tile changed. Refresh before printing"
        );
        require!(
            old.as_ref().is_none_or(|t| t.color != color),
            "Choose a different ink"
        );
        let cost = if old.is_some() { 3 } else { 1 };
        let id = env::predecessor_account_id();
        self.ink.internal_withdraw(&id, cost);
        FtBurn {
            owner_id: &id,
            amount: U128(cost),
            memo: Some("Pixel print"),
        }
        .emit();
        let mut p = player(id.as_str());
        p.prints += 1;
        save(id.as_str(), &p);
        let mut s = stats();
        s.burned += cost as u64;
        s.prints += 1;
        put("stats", &s);
        let tile = Tile {
            color,
            owner: id.to_string(),
            revision: revision + 1,
        };
        put(&key, &tile);
        serde_json::json!(tile)
    }
    #[payable]
    pub fn gift(&mut self, receiver: AccountId, amount: u64) -> Player {
        let id = env::predecessor_account_id();
        near_sdk::assert_one_yocto();
        self.ink
            .internal_transfer(&id, &receiver, amount as u128, Some("Studio gift".into()));
        self.get_player(id)
    }
}
// The original house plate is printed beneath the player-owned layer.
// Digits are palette indexes; a dot is uninked paper.
const BASE_PLATE: [&str; 16] = [
    "................",
    "................",
    "....55....55....",
    "...5005..5005...",
    "...5055555055...",
    "..500000000005..",
    ".50000000000005.",
    ".50110000001105.",
    ".50050000005005.",
    "..500555555005..",
    "...5500000055...",
    "..500555555005..",
    ".50002222220005.",
    "..555555555555..",
    "................",
    "................",
];
