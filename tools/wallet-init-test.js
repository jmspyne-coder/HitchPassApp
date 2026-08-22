/* Behavioral harness for the per-account wallet — ruling jr-20260822-hitchpass-wallet-empty-account-scoped.
   Run: node tools/wallet-init-test.js   (no deps, exits non-zero on any failed assertion)

   The function bodies below are lifted VERBATIM from index.html. If you change them there, change them
   here — this file exists so the account-scoping claims in that code's comment block are checkable
   rather than asserted. It touches nothing real: localStorage is an in-memory stub, there is no network.

   Three tests exist because three separate merge-gate findings had to be closed, and each is a
   regression test for one of them:
     M1  the migration window — an existing account is KEYLESS until its first post-deploy sign-in;
         a signup in that window must not destroy the only copy of its cards.   (starts with NO scoped keys)
     M2  shared device, post-migration — a signup must not destroy an account that already has a key.
     M3  in-memory carryover — after sign-out, the next account must not inherit the previous one's cards. */
var store = {};
var localStorage = {
  getItem: function(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
  setItem: function(k,v){ store[k] = String(v); }
};
var KEY = "hitchpass.v1";
var DEFAULT_WALLET = ["tt","enc"];
var LEGACY_WALLET_KEY = "hp_wallet_legacy";
var LEGACY_CLAIMED_KEY = "hp_wallet_legacy_claimed";
var signupInFlight = false;
var newAccountIds = {};
var state = { wallet: null, account: { session: null } };
function persist(){ localStorage.setItem(KEY, JSON.stringify({ wallet: state.wallet })); writeAccountWallet(); }
function signIn(uid){ state.account.session = { user: { id: uid } }; }
function signOut(){ state.account.session = null; state.wallet = DEFAULT_WALLET.slice(); }   // mirrors authSignOut
function deviceWallet(){ try { return JSON.parse(store[KEY]).wallet; } catch(e){ return null; } }
/* mirrors the boot-time snapshot IIFE in index.html */
function bootSnapshot(){
  var saved; try { saved = JSON.parse(store[KEY]) || {}; } catch(e){ saved = {}; }
  state.wallet = Array.isArray(saved.wallet) ? saved.wallet.slice() : DEFAULT_WALLET.slice();
  if (store[LEGACY_WALLET_KEY] !== undefined) return;
  if (store[LEGACY_CLAIMED_KEY] !== undefined) return;
  if (Array.isArray(saved.wallet)) localStorage.setItem(LEGACY_WALLET_KEY, JSON.stringify(saved.wallet));
}

  function currentUid(){ var u = state.account.session && state.account.session.user; return u ? u.id : null; }
  function walletKey(){ var uid = currentUid(); return uid ? ("hp_wallet:" + uid) : null; }
  function readAccountWallet(){
    var k = walletKey(); if (!k) return null;
    try { var raw = localStorage.getItem(k); if (raw === null) return null; var w = JSON.parse(raw); return Array.isArray(w) ? w : null; } catch (e) { return null; }
  }
  function writeAccountWallet(){
    var k = walletKey(); if (!k) return;
    try { localStorage.setItem(k, JSON.stringify(state.wallet)); } catch (e) {}
  }
  function readLegacyWallet(){
    try { var raw = localStorage.getItem(LEGACY_WALLET_KEY); if (raw === null) return null; var w = JSON.parse(raw); return Array.isArray(w) ? w : null; } catch (e) { return null; }
  }
  function legacyClaimedBy(){ try { return localStorage.getItem(LEGACY_CLAIMED_KEY); } catch (e) { return null; } }
  function syncAccountWallet(){
    if (signupInFlight) return false;
    var uid = currentUid(); if (!uid) return false;
    var mine = readAccountWallet();
    if (mine){ state.wallet = mine; return true; }          // an empty array is a real answer, not "missing"
    if (newAccountIds[uid]){                                 // created this session; session may have arrived late
      state.wallet = [];
      writeAccountWallet();
      return true;
    }
    var legacy = readLegacyWallet(), claimedBy = legacyClaimedBy();
    if (legacy && (!claimedBy || claimedBy === uid)){        // the pre-deploy migration: claimable once
      state.wallet = legacy;
      try { localStorage.setItem(LEGACY_CLAIMED_KEY, uid); } catch (e) {}
      writeAccountWallet();
      return true;
    }
    state.wallet = DEFAULT_WALLET.slice();                   // this account has no wallet on this device
    writeAccountWallet();
    return true;
  }
  function applyNewAccountWallet(){
    if (!currentUid()) return false;
    if (readAccountWallet()) return false;
    state.wallet = [];
    writeAccountWallet();
    return true;
  }
var fails = 0, n = 0;
function ck(label, got, want){
  n++; var ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL") + "  " + label + "  got=" + JSON.stringify(got) + " want=" + JSON.stringify(want));
}
function reset(){ store = {}; newAccountIds = {}; signupInFlight = false; state = { wallet: null, account: { session: null } }; }

// --- T1: brand-new signup on a clean device -> empty -> designed zero-state ---
reset(); bootSnapshot(); signIn("uid-NEW"); newAccountIds["uid-NEW"] = true;
ck("T1 initialised", applyNewAccountWallet(), true);
ck("T1 wallet empty", state.wallet, []);
ck("T1 zero-state reached (heldIds.length===0)", state.wallet.length === 0, true);
ck("T1 stored in its OWN key", store["hp_wallet:uid-NEW"], "[]");
ck("T1 clean device has nothing to snapshot", store[LEGACY_WALLET_KEY], undefined);

// --- T2: idempotent — a duplicate auth callback must not re-zero a filled wallet ---
state.wallet = ["tt"]; persist();
ck("T2 second call is a no-op", applyNewAccountWallet(), false);
ck("T2 wallet untouched", state.wallet, ["tt"]);

// --- M1 REGRESSION: existing account A is KEYLESS; B signs up before A ever signs in ---
reset();
localStorage.setItem(KEY, JSON.stringify({ wallet: ["tt","enc","tc"] }));   // A's pre-deploy device state
bootSnapshot();
ck("M1 legacy snapshot taken at boot", JSON.parse(store[LEGACY_WALLET_KEY]), ["tt","enc","tc"]);
ck("M1 no scoped keys exist yet", Object.keys(store).filter(function(k){return k.indexOf("hp_wallet:")===0;}), []);
signIn("uid-B"); newAccountIds["uid-B"] = true; applyNewAccountWallet();
state.wallet = ["rpi"]; persist();                                          // B uses the app, blob now B's
ck("M1 global blob has been overwritten by B", deviceWallet(), ["rpi"]);
signOut(); signIn("uid-A"); syncAccountWallet();                            // A finally signs in
ck("M1 A RECOVERS its real cards from the snapshot", state.wallet, ["tt","enc","tc"]);
ck("M1 A's cards now live in A's own key", JSON.parse(store["hp_wallet:uid-A"]), ["tt","enc","tc"]);
ck("M1 B was unaffected", JSON.parse(store["hp_wallet:uid-B"]), ["rpi"]);

// --- M1b: a THIRD account on that device does not also claim the legacy wallet ---
signOut(); signIn("uid-C"); syncAccountWallet();
ck("M1b legacy is claimable once; C gets the default", state.wallet, DEFAULT_WALLET);
ck("M1b C did not inherit A's cards", JSON.parse(store["hp_wallet:uid-C"]), DEFAULT_WALLET);
ck("M1b claim recorded against A", store[LEGACY_CLAIMED_KEY], "uid-A");

// --- M2 REGRESSION: shared device, A already has a key; B signs up ---
reset(); bootSnapshot();
signIn("uid-A"); state.wallet = ["tt","enc","tc"]; persist();
var aBefore = state.wallet.slice();
signOut();
signIn("uid-B"); newAccountIds["uid-B"] = true; applyNewAccountWallet();
ck("M2 B starts empty", state.wallet, []);
ck("M2 A's cards SURVIVE B's signup", JSON.parse(store["hp_wallet:uid-A"]), aBefore);
signOut(); signIn("uid-A"); syncAccountWallet();
ck("M2 A gets its own wallet back", state.wallet, aBefore);
ck("M2 A and B never share a key", Object.keys(store).filter(function(k){return k.indexOf("hp_wallet:")===0;}).sort(), ["hp_wallet:uid-A","hp_wallet:uid-B"]);

// --- M3 REGRESSION: in-memory carryover must not contaminate the next account ---
reset(); bootSnapshot();
signIn("uid-A"); state.wallet = ["tt","enc","tc","rpi"]; persist();
signOut();                                                                  // authSignOut resets state.wallet
signIn("uid-D"); syncAccountWallet();                                       // D is an EXISTING account, first time here
ck("M3 D did NOT inherit A's in-memory cards", state.wallet, DEFAULT_WALLET);
ck("M3 D's key holds the default, not A's list", JSON.parse(store["hp_wallet:uid-D"]), DEFAULT_WALLET);
ck("M3 A's key still intact", JSON.parse(store["hp_wallet:uid-A"]), ["tt","enc","tc","rpi"]);

// --- T4 MIGRATION happy path: single-user device, wallet adopted unchanged ---
reset();
localStorage.setItem(KEY, JSON.stringify({ wallet: ["tt","enc"] }));
bootSnapshot(); signIn("uid-LEGACY");
ck("T4 sync ran", syncAccountWallet(), true);
ck("T4 existing user's wallet UNCHANGED", state.wallet, ["tt","enc"]);
ck("T4 adopted into their namespace", JSON.parse(store["hp_wallet:uid-LEGACY"]), ["tt","enc"]);
ck("T4 device blob untouched by the migration", deviceWallet(), ["tt","enc"]);

// --- T5: an account whose wallet is legitimately EMPTY stays empty ---
state.wallet = ["tt","enc"];
signIn("uid-EMPTY"); store["hp_wallet:uid-EMPTY"] = "[]";
syncAccountWallet();
ck("T5 empty array is a real answer, not 'missing'", state.wallet, []);

// --- T6: signup-in-flight defers sync, so SIGNED_IN ordering cannot pre-adopt ---
reset(); bootSnapshot(); signIn("uid-RACE"); state.wallet = ["tt","enc"]; signupInFlight = true;
ck("T6 sync deferred while signup in flight", syncAccountWallet(), false);
ck("T6 nothing written during the race window", Object.keys(store), []);
signupInFlight = false; newAccountIds["uid-RACE"] = true;
ck("T6 signup then wins and starts empty", applyNewAccountWallet(), true);
ck("T6 wallet empty after race", state.wallet, []);

// --- T6b: late-arriving session for a new account still starts empty (confirm-email path) ---
reset(); bootSnapshot(); newAccountIds["uid-LATE"] = true; signIn("uid-LATE");
ck("T6b late session recognised as new", syncAccountWallet(), true);
ck("T6b late new account starts empty", state.wallet, []);

// --- T7: signed out -> every entry point is inert ---
reset(); state.wallet = ["tt","enc"];
ck("T7 sync no-op when signed out", syncAccountWallet(), false);
ck("T7 apply no-op when signed out", applyNewAccountWallet(), false);
ck("T7 wallet untouched when signed out", state.wallet, ["tt","enc"]);
ck("T7 nothing written when signed out", Object.keys(store), []);

console.log(fails === 0 ? "\nALL TESTS PASS (" + n + " assertions)" : "\n" + fails + " ASSERTION(S) FAILED");
process.exit(fails === 0 ? 0 : 1);
