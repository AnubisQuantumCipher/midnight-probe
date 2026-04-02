import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  CompatibilityMatrixAttempt,
  CompatibilityProbeRecord,
  CompatibilityReport,
  CompatibilitySelection,
  RuntimeFingerprint,
} from './types.js';
import { DEFAULT_COMPATIBILITY_REPORT_PATH, writeJsonFile } from './util.js';

export function resolveCompatibilityReportPath(customPath = DEFAULT_COMPATIBILITY_REPORT_PATH): string {
  return resolve(customPath);
}

export async function readCompatibilityReport(
  reportPath = DEFAULT_COMPATIBILITY_REPORT_PATH,
): Promise<CompatibilityReport | null> {
  try {
    const raw = await readFile(resolveCompatibilityReportPath(reportPath), 'utf-8');
    return JSON.parse(raw) as CompatibilityReport;
  } catch {
    return null;
  }
}

export async function writeCompatibilityReport(
  report: CompatibilityReport,
  reportPath = DEFAULT_COMPATIBILITY_REPORT_PATH,
): Promise<void> {
  await writeJsonFile(resolveCompatibilityReportPath(reportPath), report);
}

export function withProfile(report: CompatibilityReport | null, profile: RuntimeFingerprint): CompatibilityReport {
  const profiles = [...(report?.profiles ?? [])];
  const index = profiles.findIndex((entry) => entry.network === profile.network && entry.rpcUrl === profile.rpcUrl);
  if (index >= 0) {
    profiles[index] = profile;
  } else {
    profiles.push(profile);
  }
  return {
    generatedAt: new Date().toISOString(),
    profiles,
    probes: report?.probes ?? [],
    matrices: report?.matrices ?? [],
    selected: report?.selected ?? null,
  };
}

export function withProbe(report: CompatibilityReport | null, probe: CompatibilityProbeRecord): CompatibilityReport {
  return {
    generatedAt: new Date().toISOString(),
    profiles: report?.profiles ?? [],
    probes: [...(report?.probes ?? []), probe],
    matrices: report?.matrices ?? [],
    selected: report?.selected ?? null,
  };
}

export function withMatrixAttempt(
  report: CompatibilityReport | null,
  attempt: CompatibilityMatrixAttempt,
): CompatibilityReport {
  const matrices = [...(report?.matrices ?? [])];
  const index = matrices.findIndex((entry) => entry.matrixId === attempt.matrixId);
  if (index >= 0) {
    matrices[index] = attempt;
  } else {
    matrices.push(attempt);
  }
  return {
    generatedAt: new Date().toISOString(),
    profiles: report?.profiles ?? [],
    probes: report?.probes ?? [],
    matrices,
    selected: report?.selected ?? null,
  };
}

export function withSelection(
  report: CompatibilityReport | null,
  selection: CompatibilitySelection | null,
): CompatibilityReport {
  return {
    generatedAt: new Date().toISOString(),
    profiles: report?.profiles ?? [],
    probes: report?.probes ?? [],
    matrices: report?.matrices ?? [],
    selected: selection,
  };
}
