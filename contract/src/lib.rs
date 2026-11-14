//! FrogPress runs on NEAR. Amounts are whole units of the game's transferable ink.
use serde::{de::DeserializeOwned, Deserialize, Serialize};

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[link(wasm_import_module = "env")]
extern "C" {
    fn input(register: u64);
    fn predecessor_account_id(register: u64);
    fn read_register(register: u64, ptr: u64);
    fn register_len(register: u64) -> u64;
    fn block_timestamp() -> u64;
    fn storage_read(len: u64, ptr: u64, register: u64) -> u64;
    fn storage_write(kl: u64, kp: u64, vl: u64, vp: u64, register: u64) -> u64;
    fn value_return(len: u64, ptr: u64);
    fn panic_utf8(len: u64, ptr: u64) -> !;
}
fn reject(msg: &str) -> ! {
    unsafe { panic_utf8(msg.len() as _, msg.as_ptr() as _) }
}
fn require(ok: bool, msg: &str) {
    if !ok {
        reject(msg)
    }
}
fn read_reg() -> Vec<u8> {
    unsafe {
        let mut data = vec![0; register_len(0) as usize];
        read_register(0, data.as_mut_ptr() as _);
        data
    }
}
fn args<T: DeserializeOwned>() -> T {
    unsafe { input(0) };
    serde_json::from_slice(&read_reg()).unwrap_or_else(|_| reject("Invalid arguments"))
}
fn caller() -> String {
    unsafe { predecessor_account_id(0) };
    String::from_utf8(read_reg()).unwrap()
}
fn get<T: DeserializeOwned>(key: &str) -> Option<T> {
    if unsafe { storage_read(key.len() as _, key.as_ptr() as _, 0) } == 1 {
        Some(serde_json::from_slice(&read_reg()).unwrap())
    } else {
        None
    }
}
fn put<T: Serialize>(key: &str, value: &T) {
    let b = serde_json::to_vec(value).unwrap();
    unsafe {
        storage_write(
            key.len() as _,
            key.as_ptr() as _,
            b.len() as _,
            b.as_ptr() as _,
            0,
        )
    };
}
fn output<T: Serialize>(value: &T) {
    let b = serde_json::to_vec(value).unwrap();
    unsafe { value_return(b.len() as _, b.as_ptr() as _) };
}
const DAY: u64 = 86_400_000_000_000;
#[derive(Default, Serialize, Deserialize)]
struct Player {
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
#[derive(Deserialize)]
struct Account {
    account_id: String,
}
#[derive(Deserialize)]
struct Print {
    index: u16,
    color: u8,
    revision: u64,
}
#[derive(Deserialize)]
struct Gift {
    receiver: String,
    amount: u64,
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
    (unsafe { block_timestamp() }) / DAY
}

#[no_mangle]
pub extern "C" fn get_board() {
    let tiles: Vec<Option<Tile>> = (0..256).map(|i| get(&tile_key(i))).collect();
    output(&serde_json::json!({"tiles":tiles,"stats":stats(),"day":today()}))
}
#[no_mangle]
pub extern "C" fn get_player() {
    output(&player(&args::<Account>().account_id))
}
#[no_mangle]
pub extern "C" fn claim() {
    let id = caller();
    let mut p = player(&id);
    let mut s = stats();
    let day = today();
    require(p.last_claim != Some(day), "Already claimed today");
    if p.last_claim.is_none() {
        s.players += 1
    }
    p.last_claim = Some(day);
    p.balance += 8;
    s.minted += 8;
    save(&id, &p);
    put("stats", &s);
    output(&p)
}
#[no_mangle]
pub extern "C" fn print_tile() {
    let a = args::<Print>();
    require(a.index < 256 && a.color < 6, "Invalid tile or ink");
    let key = tile_key(a.index);
    let old: Option<Tile> = get(&key);
    require(
        old.as_ref().map_or(0, |t| t.revision) == a.revision,
        "Tile changed. Refresh before printing",
    );
    require(
        old.as_ref().map_or(true, |t| t.color != a.color),
        "Choose a different ink",
    );
    let cost = if old.is_some() { 3 } else { 1 };
    let id = caller();
    let mut p = player(&id);
    require(p.balance >= cost, "Insufficient ink");
    p.balance -= cost;
    p.prints += 1;
    let mut s = stats();
    s.burned += cost;
    s.prints += 1;
    let tile = Tile {
        color: a.color,
        owner: id.clone(),
        revision: a.revision + 1,
    };
    save(&id, &p);
    put("stats", &s);
    put(&key, &tile);
    output(&tile)
}
#[no_mangle]
pub extern "C" fn gift() {
    let a = args::<Gift>();
    let id = caller();
    require(a.receiver != id && a.amount > 0, "Invalid gift");
    let mut sender = player(&id);
    let mut recipient = player(&a.receiver);
    require(
        recipient.last_claim.is_some(),
        "Recipient must claim ink first",
    );
    require(sender.balance >= a.amount, "Insufficient ink");
    sender.balance -= a.amount;
    recipient.balance += a.amount;
    save(&id, &sender);
    save(&a.receiver, &recipient);
    output(&sender)
}
