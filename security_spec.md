# Security Specification — ระบบรายงานพึงรับ-พึงจ่าย รพ.สต.

## 1. Data Invariants
1. **Unit Ownership Invariant**: Every `/units/{unitId}` document MUST have `unitId == request.auth.uid` and `ownerUid == request.auth.uid`, with `request.auth.token.email_verified == true`.
2. **Master Gate Invariant**: Every subcollection document (`claimRecords`, `ssoSubmissions`, `apiKeys`) under `/units/{unitId}/...` MUST belong to an existing parent `/units/{unitId}` owned by `request.auth.uid` and carry an immutable `ownerUid == request.auth.uid` and `unitId == unitId`.
3. **Strict Schema & No Ghost Fields**: All creates MUST verify `keys().hasAll(...)` and `keys().hasOnly(...)` matching `firebase-blueprint.json` with strict numeric bounds (`>= 0`, `<= 1000000000`) and string `.size()` limits.
4. **Action-Based Updates & Terminal State Locking**:
   - `units`: Only profile fields (`unitCode`, `unitName`, `districtName`, `templateVersion`, `ssoEndpointUrl`, `updatedAt`) may change. `ownerUid` and `createdAt` are immutable.
   - `claimRecords`: Only editable claim/payable fields (`payableAmount`, `note`, `reportPeriod`, `monthKey`, fund/claim numbers, `updatedAt`) may change. `ownerUid`, `unitId`, `importBatchId`, `createdAt` are immutable.
   - `ssoSubmissions`: Terminal status `'acknowledged'` cannot be reverted or modified once acknowledged; only `'submitted' -> 'acknowledged'` transition is permitted, and financial totals are immutable.
   - `apiKeys`: Terminal status `'revoked'` cannot be reactivated; only `'active' -> 'revoked'` transition is permitted, and `keyHash`/`keyPrefix` are immutable.
   - `repTransactions`: Patient/transaction-level PII (`pid`, `fullName`, `hn`) is strictly scoped to verified unit owner (`ownerUid == request.auth.uid && unitId == unitId`) and immutable once imported (re-import replaces via delete+create).
5. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps MUST equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing on Unit Creation**: Creating `/units/victim_uid` with `ownerUid: "victim_uid"` while authenticated as `"attacker_uid"` -> MUST return `PERMISSION_DENIED`.
2. **Unverified Email Write**: Creating `/units/attacker_uid` with `email_verified: false` -> MUST return `PERMISSION_DENIED`.
3. **Ghost Field Injection (Shadow Update)**: Updating `/units/{uid}` with extra field `{ isAdmin: true }` -> MUST return `PERMISSION_DENIED`.
4. **Path Variable ID Poisoning**: Creating `/units/{uid}/claimRecords/bad$id!@#` or a 1,500-char ID -> MUST return `PERMISSION_DENIED`.
5. **Client Timestamp Forgery**: Creating a `claimRecord` with `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()` (`request.time`) -> MUST return `PERMISSION_DENIED`.
6. **Negative Financial Value Poisoning**: Creating a `claimRecord` with `claimedAmount: -5000` -> MUST return `PERMISSION_DENIED`.
7. **Orphaned Subcollection Write**: Writing to `/units/nonexistent_unit/claimRecords/rec1` when parent unit does not exist -> MUST return `PERMISSION_DENIED`.
8. **Cross-Tenant List Scraping**: Listing `/units/{victim_uid}/claimRecords` without `where("ownerUid", "==", request.auth.uid)` or as non-owner -> MUST return `PERMISSION_DENIED`.
9. **Immutable Field Mutation**: Updating `claimRecord` to change `ownerUid` or `importBatchId` -> MUST return `PERMISSION_DENIED`.
10. **Terminal State Reversal (SSO Submission)**: Updating an `'acknowledged'` `ssoSubmission` back to `'submitted'` or altering `totalClaimedAmount` -> MUST return `PERMISSION_DENIED`.
11. **API Key Hash Tampering / Reactivation**: Updating a `'revoked'` `apiKey` back to `'active'` or swapping `keyHash` -> MUST return `PERMISSION_DENIED`.
12. **Denial-of-Wallet Oversized String**: Sending a 50KB string in `claimRecord.note` or `unit.unitName` -> MUST return `PERMISSION_DENIED`.
