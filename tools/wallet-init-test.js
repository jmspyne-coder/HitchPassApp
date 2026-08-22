/* Behavioral harness for the per-account wallet — ruling jr-20260822-hitchpass-wallet-empty-account-scoped.
   Run: node tools/wallet-init-test.js   (no deps, exits non-zero on any failed assertion)

   The five function bodies below are lifted VERBATIM from index.html (walletKey, readAccountWallet,
   writeAccountWallet, syncAccountWallet, applyNewAccountWallet). If you change them there, change them
   here — this file exists so the account-scoping claim in that code's comment block is checkable rather
   than asserted. It touches nothing real: localStorage is an in-memory stub and there is no network.

   T3 is the regression test for the defect both merge gates caught on the first cut: zeroing the shared
   `hitchpass.v1` blob permanently destroyed a previous account's cards on a shared device. */
var store = {};
var localStorage = {
  getItem: function(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
  setItem: function(k,v){ store[k] = String(v); }
};
var KEY = "hitchpass.v1";
var signupInFlight = false;
var state = { wallet: null, account: { session: null } };
function persist(){ localStorage.setItem(KEY, JSON.stringify({ wallet: state.wallet })); writeAccountWallet(); }
function signIn(uid){ state.account.session = { user: { id: uid } }; }
function signOut(){ state.account.session = null; }
function deviceWallet(){ try { return JSON.parse(store[KEY]).wallet; } catch(e){ return null; } }

  function walletKey(){ var u = state.account.session && state.account.session.user; return u ? ("hp_wallet:" + u.id) : null; }
  function readAccountWallet(){
    var k = walletKey(); if (!k) return null;
    try { var raw = localStorage.getItem(k); if (raw === null) return null; var w = JSON.parse(raw); return Array.isArray(w) ? w : null; } catch (e) { return null; }
  }
  function writeAccountWallet(){
    var k = walletKey(); if (!k) return;
    try { localStorage.setItem(k, JSON.stringify(state.wallet)); } catch (e) {}
  }
  function syncAccountWallet(){
    if (signupInFlight) return false;
    if (!walletKey()) return false;
    var mine = readAccountWallet();
    if (mine){ state.wallet = mine; return true; }   // note: an empty array is a real answer, not "missing"
    writeAccountWallet();
    return true;
  }
  function applyNewAccountWallet(){
    if (!walletKey()) return false;
    if (readAccountWallet()) return false;   // this account already has a wallet — never zero it
    state.wallet = [];
    writeAccountWallet();
    persist();
    return true;
  }
var fails = 0, n = 0;
function ck(label, got, want){
  n++; var ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL") + "  " + label + "  got=" + JSON.stringify(got) + " want=" + JSON.stringify(want));
}

// --- T1: brand-new signup on a clean device -> empty wallet -> designed zero-state ---
signIn("uid-NEW"); state.wallet = ["tt","enc"];              // the seed a new account would otherwise inherit
ck("T1 initialised", applyNewAccountWallet(), true);
ck("T1 wallet empty", state.wallet, []);
ck("T1 zero-state reached (heldIds.length===0)", state.wallet.length === 0, true);
ck("T1 stored in its OWN namespace", store["hp_wallet:uid-NEW"], "[]");

// --- T2: idempotent — new user adds a card, a duplicate auth callback must not re-zero it ---
state.wallet = ["tt"]; persist();
ck("T2 second call is a no-op", applyNewAccountWallet(), false);
ck("T2 wallet untouched", state.wallet, ["tt"]);

// --- T3: REGRESSION. Shared device: a new signup must NOT destroy the previous account's cards ---
store = {}; signIn("uid-A"); state.wallet = ["tt","enc","tc"]; persist();   // A builds a wallet
var aBefore = state.wallet.slice();
signOut();                                                                  // A signs out; blob still holds A's cards
signIn("uid-B"); applyNewAccountWallet();                                   // B signs UP on the same device
ck("T3 B starts empty", state.wallet, []);
ck("T3 A's cards SURVIVE the new signup", JSON.parse(store["hp_wallet:uid-A"]), aBefore);
signOut(); signIn("uid-A"); syncAccountWallet();                            // A signs back in
ck("T3 A gets its own wallet back, unchanged", state.wallet, aBefore);
ck("T3 A and B never share a key", Object.keys(store).filter(function(k){return k.indexOf("hp_wallet:")===0;}).sort(), ["hp_wallet:uid-A","hp_wallet:uid-B"]);

// --- T4: MIGRATION. An existing user's first sign-in after this deploy adopts their device wallet ---
store = {}; state.wallet = ["tt","enc"];                     // what is already on the device, pre-deploy
localStorage.setItem(KEY, JSON.stringify({ wallet: state.wallet }));
signIn("uid-LEGACY");
ck("T4 sync ran", syncAccountWallet(), true);
ck("T4 existing user's wallet UNCHANGED", state.wallet, ["tt","enc"]);
ck("T4 adopted into their namespace", JSON.parse(store["hp_wallet:uid-LEGACY"]), ["tt","enc"]);
ck("T4 device blob untouched", deviceWallet(), ["tt","enc"]);

// --- T5: an account whose wallet is legitimately EMPTY stays empty (does not re-adopt the device) ---
state.wallet = ["tt","enc"];                                  // stale in-memory value from a prior account
signIn("uid-NEW"); store["hp_wallet:uid-NEW"] = "[]";
syncAccountWallet();
ck("T5 empty array is a real answer, not 'missing'", state.wallet, []);

// --- T6: signup-in-flight defers sync, so SIGNED_IN ordering cannot pre-adopt the seed ---
store = {}; signIn("uid-RACE"); state.wallet = ["tt","enc"]; signupInFlight = true;
ck("T6 sync deferred while signup in flight", syncAccountWallet(), false);
ck("T6 nothing written during the race window", Object.keys(store), []);
signupInFlight = false;
ck("T6 signup then wins and starts empty", applyNewAccountWallet(), true);
ck("T6 wallet empty after race", state.wallet, []);

// --- T7: signed out -> every entry point is inert ---
store = {}; signOut(); state.wallet = ["tt","enc"];
ck("T7 sync no-op when signed out", syncAccountWallet(), false);
ck("T7 apply no-op when signed out", applyNewAccountWallet(), false);
ck("T7 wallet untouched when signed out", state.wallet, ["tt","enc"]);
ck("T7 nothing written when signed out", Object.keys(store), []);

console.log(fails === 0 ? "\nALL TESTS PASS (" + n + " assertions)" : "\n" + fails + " ASSERTION(S) FAILED");
process.exit(fails === 0 ? 0 : 1);
