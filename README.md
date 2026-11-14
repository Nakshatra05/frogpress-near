# FrogPress

**A multiplayer print studio on NEAR.** Change a pixel with fungible ink. Pull the mural as a one-of-one NFT. The collector's ink goes to the artists whose marks survive on the canvas.

[Open the studio](https://frogpress-near.vercel.app/studio) · [Inspect edition #1](https://frogpress-near.vercel.app/edition/1) · [Watch the 42-second demo](https://github.com/Nakshatra05/frogpress-near/raw/refs/heads/main/docs/demo.mp4) · [Live contract](https://testnet.nearblocks.io/address/frogpress-mwgyuaa4.testnet)

## Exhibit a print and support its artists

[Open a two-edition show](https://frogpress-near.vercel.app/show?editions=2,1&title=FrogPress%20Print%20Club) · [Open the patron desk](https://frogpress-near.vercel.app/edition/2#patrons) · [Watch the gallery walkthrough](https://frogpress-near.vercel.app/gallery-demo.mp4)

A club can curate up to twelve minted editions from the landing page and share its projector URL. Slides rotate every fifteen seconds, with pause, manual navigation and fullscreen controls. Each slide carries a QR code. On the edition page, **Print exhibition sheet** produces a one-page A5 exhibition label with artwork, credits and the same scannable destination.

Visitors can read credits without a player account. They can also create a testnet player at the patron desk, claim daily ink and send 4, 8 or 16 ink in the edition’s original proportions. The contract reads those proportions from the NFT and settles transfers atomically. It records the amount actually delivered, excluding a patron’s own retained share. If a recipient has unregistered from the ink contract, payment fails atomically. The expected payment count prevents replaying a stale payment instruction. Patronage works for editions minted before this upgrade.

**Verified example.** Edition #2 had already transferred when a new visitor selected eight ink. The three artists received four, two and two; the collector and the current NFT owner at payment time were different accounts. The live check reads the original edition metadata and independently compares it to the three finalized NEP-141 transfer logs. [Payment receipt](https://testnet.nearblocks.io/txns/87bipBWuX6Rbi2X2s41w7Xwh7T3mAD216fDpgU5hPzUw) · [Earlier NFT transfer](https://testnet.nearblocks.io/txns/Cdz1FX11uUFBvip6e65rpVyjbRBUNuNQWpgdDSXPbiqT).

## Try it in a minute

1. Open the studio and create a testnet player. A dedicated signing key is generated in your browser. The NEAR faucet provisions the account and testnet gas.
2. Claim **8 $INK**, choose a tile, select a color, and print. A tile's first player mark costs 1 ink. Replacing a player's color costs 3. Each print burns its cost. The original frog is a house plate. Only player marks qualify for payouts.
3. Select **Collect edition**. For 4 ink, the contract freezes the exact 256 colors, mints a numbered NFT, and allocates the price to up to four artists. A stale board revision rejects the call before settlement.
4. Open the edition. Inspect its owner and original payouts, download the art, or transfer the NFT to another existing NEAR testnet account. A collector can keep their own share if they are also a contributing artist.
5. Open another browser profile to play as a second person. Both players can gift ink and redraw the same mural. Reload either profile to see persistent chain state.

The underlying ledger is a deployed NEAR contract. The web app has no database or privileged signing service. Losing this browser's site data loses the guest key. Use the dedicated account only for testnet play. A browser player is one account, not proof of a unique person. Account creation depends on the public testnet faucet. Existing players remain usable during faucet downtime.

## Settlement rules

- **$INK** uses NEP-141, NEP-145 and NEP-148. Zero decimals. One mint of eight units per account per UTC day. The contract uses block time. Printed tiles use optimistic concurrency on their per-tile revision.
- **Editions** implement NEP-171 core, NEP-177 metadata, and NEP-181 enumeration via the NEAR contract standards library. An edition is unique to one global print revision. Token metadata stores the original raster, print number, collector and payout map. Ownership can change after mint. Later mural edits leave the edition intact.
- **Artist split** ranks currently registered ink accounts by visible tiles, then by account ID ascending to resolve ties. Four whole ink units cycle among the top four. With three winners the split is 2/1/1. The original collector's share stays in their wallet. All other shares transfer in the mint transaction. The total ink supply is unchanged by collection.
- First claims attach up to 0.02 testnet NEAR for registration and profile storage. Collection attaches up to 0.1 testnet NEAR for NFT storage. The contract refunds excess. Network gas is charged in testnet NEAR. The operator funds storage for the bounded 256-tile board.
- Each successful action exposes an explorer receipt. The app reads finalized blocks and waits for final transaction status. A new claim may be available every UTC midnight.

## Verify independently

Node 22.12+ or 24, npm, and network access for live checks. No API keys or environment variables are needed.

```sh
npm ci
npm test
npm run verify:live
npm run dev
```

Open the local URL printed by Vite. The development studio uses the same public testnet mural as production. For a production build, run `npm run build` and `npm run preview`. The Vercel deployment also serves the NFT media endpoint `/api/edition?id=1`; the edition page itself renders directly from on-chain data.

The read-only live check compares the SHA-256 hash of the committed WASM to the code hash returned by NEAR. It also reads token metadata, the board and edition #1, checks the payout total and reconstructs the art. `npm test` checks raster coordinates, input validation and media route errors offline.

| Demonstrated action                                                     | NEAR testnet receipt                                                                            |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Deploy the two token standards and migrate all existing player balances | [Upgrade](https://testnet.nearblocks.io/txns/mCgz5cipQWuikMGVTj4Sohk4fjgFVX7mCE7YrVzojoN)       |
| Claim 8 ink                                                             | [Claim](https://testnet.nearblocks.io/txns/6wXS2HdppEquyYAtcNzgiY5FJu3WvT725XPPE7rQ49HC)        |
| Print a pixel                                                           | [Print](https://testnet.nearblocks.io/txns/4mcpVwZ2oW1R31hDtEeQGHonXwWTpctGXNQp1oweS2sS)        |
| Send ink between two browser players                                    | [Gift](https://testnet.nearblocks.io/txns/DnJepRj5sUQS27BB8HxKdSUUQqAg5EKV6uRjvNLQBgME)         |
| Collect edition #1 and distribute 2 ink to each of two artists          | [Mint](https://testnet.nearblocks.io/txns/7BE2SEQ9S3DwdY8b9rf4KevgpTtei8eYADE8F5oAA6JH)         |
| Transfer edition #2 between testnet accounts                            | [NFT transfer](https://testnet.nearblocks.io/txns/Cdz1FX11uUFBvip6e65rpVyjbRBUNuNQWpgdDSXPbiqT) |

## Contract and hosting

Rust source lives under `contract/src`. Build from the repository root with Rust 1.88.0 and the WASM target installed.

```sh
rustup target add wasm32-unknown-unknown
cargo build --manifest-path contract/Cargo.toml --locked --release --target wasm32-unknown-unknown
```

The deployed binary is `artifacts/frogpress.wasm`. To run your own instance, deploy it to a new funded testnet contract account, then call `initialize` as that account with `{"previous_players":[]}`. Set the contract ID in `shared/network.js`, the explorer link in the HTML, and the media origin in `contract/src/editions.rs` before building a fork. The check for the original edition in `scripts/verify-live.js` targets this public deployment. The Vercel project uses the Vite preset and the committed routing configuration.

## NEAR Hackathon

Recommended tracks: **Memecoins With Mechanics**, **Games With Real Economies**, and **NFTs That Do Something**. The frog's ink is a spendable community currency. Competition for space changes which artists earn the next edition's proceeds. An NFT turns the shared board into a collectible print with a verifiable creator split.

Built during the hackathon with Codex assistance. No pre-existing FrogPress code. The implementation uses Vite, near-api-js, near-sdk-rs, and the NEAR fungible/non-fungible token standards and example trait delegations. The original pixel illustrations were drawn for the project. Archivo Black and Space Mono are distributed under their included SIL Open Font Licenses.

[Organizer brief](https://nearhackathon.com/HACKATHON.md) · [NearBuilders strategy article](https://x.com/NearBuilders/status/2120390182033645642) · [NEAR token standards implementation](https://github.com/near/near-sdk-rs/tree/near-sdk-v5.17.2/near-contract-standards)
