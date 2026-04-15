import type { ApiPromise } from '@polkadot/api';

export type MidnightNetwork = 'preprod' | 'preview' | 'mainnet' | 'custom';
export type ProbeKind = 'deploy' | 'call' | 'generic';
export type ProbeOutcome = 'accepted' | 'rejected' | 'panic' | 'error' | 'skipped';
export type ValidationSource = 'External' | 'Local' | 'InBlock';
export type SubmitStrategyId = 'wallet-sdk' | 'metadata-extrinsic' | 'raw-rpc';
export type CompatibilityMatrixId = 'v4-stable' | 'v4-pre' | 'v3-compat';

export interface MidnightConnectionOptions {
  network?: MidnightNetwork;
  rpcUrl?: string;
}

export interface MidnightSignedExtensionStatus {
  runtimeSignedExtensions: string[];
  injectedSignedExtensions: string[];
  unknownSignedExtensions: string[];
}

export interface RuntimeWeightValue {
  refTime: string;
  proofSize: string;
}

export interface RuntimeFingerprint {
  observedAt: string;
  network: MidnightNetwork;
  rpcUrl: string;
  specVersion: string;
  transactionVersion: string;
  signedExtensions: string[];
  injectedSignedExtensions: string[];
  unknownSignedExtensions: string[];
  rawLedgerVersion: string | null;
  configurableTransactionSizeWeight: RuntimeWeightValue | null;
  pausedCalls: number;
  throttle: {
    palletKeys: string[];
    accountUsage: unknown;
  };
}

export interface ProbeInput {
  kind: ProbeKind;
  innerTxHex?: string;
  finalizedTxHex?: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface SyntheticCostShape {
  readTime: string;
  computeTime: string;
  blockUsage: string;
  bytesWritten: string;
  bytesChurned: string;
}

export interface NormalizedCostShape {
  readTime: number;
  computeTime: number;
  blockUsage: number;
  bytesWritten: number;
  bytesChurned: number;
}

export interface TransactionInspection {
  observedAt: string;
  network: MidnightNetwork | null;
  rpcUrl: string | null;
  input: ProbeInput;
  transactionHex: string;
  serializedBytes: number;
  deserializationMode: string;
  cost: SyntheticCostShape;
  normalizedCost: NormalizedCostShape | null;
  fitsInBlock: boolean;
  fitFailureReason: string | null;
  runtimeCost: unknown;
  runtimeCostError: string | null;
}

export interface ProbeValidationResult {
  source: ValidationSource;
  outcome: ProbeOutcome;
  detail: string;
  raw?: unknown;
}

export interface ProbeSubmitResult {
  strategy: SubmitStrategyId;
  outcome: ProbeOutcome;
  txHash: string | null;
  detail: string;
  raw?: unknown;
}

export interface WalletSubmitAdapterRequest {
  api: ApiPromise;
  network: MidnightNetwork;
  rpcUrl: string;
  input: ProbeInput;
  innerTxHex: string;
  outerTxHex: string;
}

export interface WalletSubmitAdapterResult {
  txHash?: string | null;
  detail?: string;
  raw?: unknown;
}

export interface WalletSubmitAdapter {
  submitTransaction(request: WalletSubmitAdapterRequest): Promise<WalletSubmitAdapterResult>;
}

export interface TransactionValidationReport {
  observedAt: string;
  network: MidnightNetwork;
  rpcUrl: string;
  input: ProbeInput;
  strategy: SubmitStrategyId;
  outerTxHex: string;
  signedExtensions: MidnightSignedExtensionStatus;
  validation: ProbeValidationResult[];
  submit: ProbeSubmitResult;
}

export interface CompatibilityProbeRecord {
  probeId: string;
  observedAt: string;
  matrixId: CompatibilityMatrixId | 'current';
  mode: ProbeKind;
  inspection: TransactionInspection;
  validation: TransactionValidationReport;
}

export interface CompatibilityMatrixAttempt {
  matrixId: CompatibilityMatrixId;
  workspaceDir: string;
  workspaceRetained?: boolean;
  packageVersions: Record<string, string>;
  compactcVersion: string;
  succeeded: boolean;
  fingerprint: RuntimeFingerprint | null;
  inspection: TransactionInspection | null;
  validation: TransactionValidationReport | null;
  note?: string;
}

export interface CompatibilitySelection {
  matrixId: CompatibilityMatrixId;
  strategy: SubmitStrategyId;
  network: MidnightNetwork;
  selectedAt: string;
  runtimeFingerprint: Pick<
    RuntimeFingerprint,
    'network' | 'specVersion' | 'transactionVersion' | 'signedExtensions' | 'rawLedgerVersion'
  >;
}

export interface CompatibilityReport {
  generatedAt: string;
  profiles: RuntimeFingerprint[];
  probes: CompatibilityProbeRecord[];
  matrices: CompatibilityMatrixAttempt[];
  selected: CompatibilitySelection | null;
}

export interface PrepareHookContext {
  mode: ProbeKind;
  network: MidnightNetwork;
  contractDir: string;
  env: NodeJS.ProcessEnv;
}

export interface MatrixDefinition {
  compactcVersion: string;
  packageVersions: Record<string, string>;
}
