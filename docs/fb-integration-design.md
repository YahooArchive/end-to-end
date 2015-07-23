# E2E Integration with Facebook Key Lookup

## Intro

Facebook has shipped a [feature](https://www.facebook.com/notes/protecting-the-graph/securing-email-communications-from-facebook/1611941762379302) that allows users to upload PGP public keys to their Facebook profile. It would useful for Yahoo E2E to use this feature for key lookups.

### Why? Aren't you building a key transparency server?

1. Non-Yahoo/Google mail providers might not opt in to the key transparency log. Thus, if Bob is emailing Alice and Alice's mail provider doesn't support key transparency proofs, Bob might rely on a Facebook key lookup to for evidence that a key returned by a standard HKP keyserver actually belongs to Alice.

2. If Alice's mail provider does support key transparency proofs, Bob additionally can verify that her key is published on a Facebook profile that he recognizes as Alice's. This provides a meaningful security benefit when Alice does not require her key updates to be signed by her previous key.

### Key transparency guarantees:

These are the guarantees of a [CONIKS-like](http://coniks.org) key transparency
system.

* Deters equivocation by the key provider: Any attempt to show a different key
for Alice to different users will have a high probability of producing
non-repudiable cryptographic evidence. This relies on the presence of auditors
who track the signed tree head chain.
* Ensures key binding consistency: Alice specifies some policy for allowable key
updates, ranging in strictness from "Allow any key update signed by the
provider" to "Allow key updates only if they are signed by a certifying key
that Alice controls." Alice (in CONIKS) and/or third parties (in Dename) can
check whether key updates published by the provider are consistent with this
policy and raise an alarm if not.
* In the case where Alice's key updates do not have to be signed by her
previous key, a malicious provider can replace her
key at any time. Alice can potentially complain about this if her client is
online and checking key updates, but a determined attacker can keep her
offline.

### Facebook lookup guarantees:

* Prevents equivocation by the key provider if Bob knows Alice's Facebook
account username a priori and Alice has chosen to publish her key to her
Facebook profile. A malicious provider can't change her key without detection unless the provider has her Facebook
credentials or is colluding with Facebook.

## Version 1 implementation

This is a hacky implementation that can be done now without any changes on
Facebook's end. It does rely on Alice setting her PGP key vsibility to "Public"
in Facebook's profile settings.

To fetch a key for Alice:

1. Ask Bob to enter Alice's Facebook username.
2. Make an XHR to the Facebook profile endpoint that returns the ASCII-armored public key. This isn't an officially supported API, so it could go away at any time.
3. Read the XHR response as a string and import it into the E2E keyring.

## Version 2 implementation

We will probably want to register E2E as a Facebook app so that
we can use the Graph API for logged-in users. Then we could do the following with some
hopefully-minor changes on Facebook's end:

* Look up public keys by email for friends of the logged-in user, so the user
  doesn't have to manually enter Facebook usernames. The Graph API would need
  to be modified to allow key lookups by email. (Or fetch all publicly-viewable
  public keys for all friends of the logged-in user.) Note that `graph.facebook.com/v2.4/me/friends` only returns friends of the logged-in user *who have authorized your app*, which isn't super useful here (since friends who have authorized E2E are presumably already in the E2E keyserver).
* Post E2E public keys to the logged-in user's Facebook profile once they are generated
  and added to the key transparency log. This is blocked on (1) Facebook adding
  support for ECC keys (in progress) and (2) Facebook graph API allowing
  write-access to PGP keys on a user's profile.

## Security/Privacy considerations
* To use the Facebook javascript SDK in Version 2, we have to source a script from
`connect.facebook.net/en_US/sdk.js` on the page that calls out to the Graph
API. This script should not be able to access E2E data that is not available to the Yahoo Mail environment, such as private keys, passphrases, and the plaintext content of emails that are to-be encrypted. If possible, we should use Subresource Integrity to make better guarantees that the SDK script can't be changed maliciously.
* In V1, Facebook learns that Bob is using E2E to talk to Alice. In V2, this is
  not an issue only if all keys for friends are fetched and updated at the same
  time (Facebook only learns that Bob is an E2E user, not which of his friends
  he is sending encrypted mail to).
* Yahoo Mail should not be able to learn who Bob is Facebook friends with. This
 is a potential risk if Facebook makes the Graph API changes needed for V2.
* End users who don't want to use Facebook lookups should be able to disable
  this feature. When FB lookup is disabled, the extension should refuse to make
  connections to Facebook origins, reducing attack surface. Other functionality
  should not be affected when FB lookup is disabled.
