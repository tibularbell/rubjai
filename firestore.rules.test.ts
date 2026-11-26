/**
 * Phase 0 Security Rules Verification Test Suite (Dirty Dozen Adversarial Payloads)
 * Maps each attack vector from security_spec.md against the Firestore security rules.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list';
  actorUid: string;
  emailVerified: boolean;
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const dirtyDozenPayloads: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Unit Creation',
    collectionPath: '/units/victim_uid',
    operation: 'create',
    actorUid: 'attacker_uid',
    emailVerified: true,
    payload: {
      unitCode: '05447',
      unitName: 'Spoofed Unit',
      districtName: 'SSO',
      templateVersion: 'V.3 5367',
      ssoEndpointUrl: '',
      ownerUid: 'victim_uid',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUnitProfile: data.ownerUid == request.auth.uid',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    collectionPath: '/units/attacker_uid',
    operation: 'create',
    actorUid: 'attacker_uid',
    emailVerified: false,
    payload: {
      unitCode: '05447',
      unitName: 'Unverified Unit',
      districtName: 'SSO',
      templateVersion: 'V.3 5367',
      ssoEndpointUrl: '',
      ownerUid: 'attacker_uid',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerified(): request.auth.token.email_verified == true',
  },
  {
    id: 3,
    name: 'Ghost Field Injection (Shadow Update)',
    collectionPath: '/units/user_1',
    operation: 'update',
    actorUid: 'user_1',
    emailVerified: true,
    payload: {
      unitName: 'Updated Name',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUnitProfile keys().hasOnly(...) & affectedKeys().hasOnly(...)',
  },
  {
    id: 4,
    name: 'Path Variable ID Poisoning',
    collectionPath: '/units/user_1/claimRecords/bad$id!@#',
    operation: 'create',
    actorUid: 'user_1',
    emailVerified: true,
    payload: { ownerUid: 'user_1', unitId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "isValidId(recordId): id.matches('^[a-zA-Z0-9_\\\\-]+$')",
  },
  {
    id: 5,
    name: 'Client Timestamp Forgery',
    collectionPath: '/units/user_1/claimRecords/rec_1',
    operation: 'create',
    actorUid: 'user_1',
    emailVerified: true,
    payload: {
      ownerUid: 'user_1',
      unitId: 'user_1',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 6,
    name: 'Negative Financial Value Poisoning',
    collectionPath: '/units/user_1/claimRecords/rec_1',
    operation: 'create',
    actorUid: 'user_1',
    emailVerified: true,
    payload: {
      ownerUid: 'user_1',
      unitId: 'user_1',
      claimedAmount: -5000,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isNonNegNum(data.claimedAmount): val >= 0',
  },
  {
    id: 7,
    name: 'Orphaned Subcollection Write',
    collectionPath: '/units/nonexistent_unit/claimRecords/rec_1',
    operation: 'create',
    actorUid: 'user_1',
    emailVerified: true,
    payload: {
      ownerUid: 'user_1',
      unitId: 'nonexistent_unit',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isUnitOwner(unitId): exists(...) && get(...).data.ownerUid == request.auth.uid',
  },
  {
    id: 8,
    name: 'Cross-Tenant List Scraping',
    collectionPath: '/units/victim_uid/claimRecords',
    operation: 'list',
    actorUid: 'attacker_uid',
    emailVerified: true,
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow list: if isVerified() && existing().ownerUid == request.auth.uid',
  },
  {
    id: 9,
    name: 'Immutable Field Mutation',
    collectionPath: '/units/user_1/claimRecords/rec_1',
    operation: 'update',
    actorUid: 'user_1',
    emailVerified: true,
    payload: {
      importBatchId: 'tampered_batch',
      payableAmount: 1000,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().importBatchId == existing().importBatchId && affectedKeys().hasOnly(...)',
  },
  {
    id: 10,
    name: 'Terminal State Reversal (SSO Submission)',
    collectionPath: '/units/user_1/ssoSubmissions/sub_1',
    operation: 'update',
    actorUid: 'user_1',
    emailVerified: true,
    payload: {
      status: 'submitted',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "existing().status == 'submitted' && incoming().status == 'acknowledged'",
  },
  {
    id: 11,
    name: 'API Key Hash Tampering / Reactivation',
    collectionPath: '/units/user_1/apiKeys/key_1',
    operation: 'update',
    actorUid: 'user_1',
    emailVerified: true,
    payload: {
      status: 'active',
      keyHash: '0'.repeat(64),
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "existing().status == 'active' && incoming().status == 'revoked' && incoming().keyHash == existing().keyHash",
  },
  {
    id: 12,
    name: 'Denial-of-Wallet Oversized String',
    collectionPath: '/units/user_1/claimRecords/rec_1',
    operation: 'update',
    actorUid: 'user_1',
    emailVerified: true,
    payload: {
      note: 'A'.repeat(50000),
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'data.note is string && data.note.size() <= 500',
  },
];
