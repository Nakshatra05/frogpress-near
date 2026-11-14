use crate::{get, put, Press, PressExt};
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_sdk::{env, near, require, AccountId};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Default, Serialize, Deserialize)]
pub struct Patronage {
    pub payments: u64,
    pub delivered: u64,
}

#[derive(Deserialize)]
struct Attribution {
    payouts: BTreeMap<AccountId, u64>,
}

#[near]
impl Press {
    pub fn get_patronage(&self, token_id: String) -> Patronage {
        get(&format!("patronage/{token_id}")).unwrap_or_default()
    }

    /// Use the original mint allocation even when the live mural and NFT owner change.
    #[payable]
    pub fn support_edition(
        &mut self,
        token_id: String,
        amount: u64,
        expected_payments: u64,
    ) -> Patronage {
        near_sdk::assert_one_yocto();
        require!([4, 8, 16].contains(&amount), "Choose 4, 8 or 16 INK");
        let token = self
            .tokens
            .nft_token(token_id.clone())
            .expect("Unknown edition");
        let attribution: Attribution =
            serde_json::from_str(&token.metadata.unwrap().extra.unwrap()).unwrap();
        require!(
            attribution.payouts.values().sum::<u64>() == 4,
            "Invalid original allocation"
        );
        let mut totals = self.get_patronage(token_id.clone());
        require!(
            totals.payments == expected_payments,
            "Patronage changed. Review the edition and retry"
        );
        let visitor = env::predecessor_account_id();
        let mut delivered = 0;
        for (artist, weight) in attribution.payouts {
            if artist != visitor {
                let share = weight * (amount / 4);
                self.ink.internal_transfer(
                    &visitor,
                    &artist,
                    share.into(),
                    Some(format!("Patronage for FrogPress #{token_id}")),
                );
                delivered += share;
            }
        }
        require!(delivered > 0, "You are the only credited artist");
        totals.payments = totals.payments.checked_add(1).unwrap();
        totals.delivered = totals.delivered.checked_add(delivered).unwrap();
        put(&format!("patronage/{token_id}"), &totals);
        totals
    }
}
