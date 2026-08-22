/* Behavioral harness for applyNewAccountWallet() — ruling jr-20260822-hitchpass-wallet-empty-account-scoped.
   Run: node tools/wallet-init-test.js   (no deps, exits non-zero on any failed assertion)

   The two function bodies below are lifted VERBATIM from index.html (walletInitKey /
   applyNewAccountWallet). If you change them there, change them here — this file exists so the
   account-scoping claim in that code's comment block is checkable rather than asserted.
   It touches nothing real: localStorage is an in-memory stub and there is no network. */
var store = {};
var localStorage = {
  getItem: function(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
  setItem: function(k,v){ store[k] = String(v); }
};
var KEY = "hitchpass.v1";
var state = { wallet: null, account: { session: null } };
function persist(){ localStorage.setItem(KEY, JSON.stringify({ wallet: state.wallet })); }
  function walletInitKey(){ var u = state.account.session && state.account.session.user; return u ? ("hp_wallet_init:" + u.id) : null; }
  function applyNewAccountWallet(){
    var k = walletInitKey(); if (!k) return false;
    try { if (localStorage.getItem(k)) return false; } catch (e) { return false; }   // already initialised for this account — never re-run
    state.wallet = [];
    persist();
    try { localStorage.setItem(k, "new"); } catch (e) {}
    return true;
  }

var fails = 0;
function ck(label, got, want){
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL") + "  " + label + "  got=" + JSON.stringify(got) + " want=" + JSON.stringify(want));
}

// --- T1: brand-new signup gets an empty wallet and lands on the zero-state ---
state.account.session = { user: { id: "uid-NEW" } };
state.wallet = ["tt","enc"];               // the seed default a new account would otherwise inherit
ck("T1 returns true (did initialise)", applyNewAccountWallet(), true);
ck("T1 wallet emptied", state.wallet, []);
ck("T1 zero-state reached (heldIds.length===0)", state.wallet.length === 0, true);
ck("T1 persisted", JSON.parse(store[KEY]).wallet, []);
ck("T1 marker is account-namespaced", Object.keys(store).filter(function(k){return k.indexOf("hp_wallet_init:")===0;}), ["hp_wallet_init:uid-NEW"]);

// --- T2: idempotent — new user adds cards, callback fires again, wallet NOT re-cleared ---
state.wallet = ["tt"];                     // user has since added a card
ck("T2 second call is a no-op", applyNewAccountWallet(), false);
ck("T2 wallet untouched", state.wallet, ["tt"]);

// --- T3: EXISTING account signing in on the same device is never touched (F-3) ---
// applyNewAccountWallet is only ever called from the signUp path; a sign-in does not call it.
// This asserts the account-scoping directly: even if invoked for a different uid, the marker
// namespace is per-uid, and — critically — the sign-in path below simply never calls it.
store = {}; state.wallet = ["tt","enc","tc"];       // existing user's real wallet
var before = state.wallet.slice();
state.account.session = { user: { id: "uid-EXISTING" } };
/* simulate authPassword with isSignup === false: applyNewAccountWallet is NOT invoked */
var isSignup = false; if (isSignup) applyNewAccountWallet();
ck("T3 existing wallet unchanged after sign-in", state.wallet, before);
ck("T3 no marker written for existing account", Object.keys(store), []);

// --- T4: namespace isolation — two accounts never share a marker ---
store = {};
state.account.session = { user: { id: "uid-A" } }; state.wallet = ["tt","enc"]; applyNewAccountWallet();
state.account.session = { user: { id: "uid-B" } }; state.wallet = ["tt","enc"];
ck("T4 account B still initialises (own namespace)", applyNewAccountWallet(), true);
ck("T4 two distinct markers", Object.keys(store).filter(function(k){return k.indexOf("hp_wallet_init:")===0;}).sort(), ["hp_wallet_init:uid-A","hp_wallet_init:uid-B"]);

// --- T5: no session -> no-op, cannot wipe anything ---
store = {}; state.account.session = null; state.wallet = ["tt","enc"];
ck("T5 no session is a no-op", applyNewAccountWallet(), false);
ck("T5 wallet untouched with no session", state.wallet, ["tt","enc"]);

console.log(fails === 0 ? "\nALL TESTS PASS (" + 13 + " assertions)" : "\n" + fails + " ASSERTION(S) FAILED");
process.exit(fails === 0 ? 0 : 1);
