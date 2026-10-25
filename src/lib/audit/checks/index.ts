import type { CheckResult } from "../types";
import type { AuditContext } from "../context";
import { crawlabilityChecks } from "./crawlability";
import { structuredDataChecks } from "./structured-data";
import { contentChecks } from "./content";
import { entityChecks } from "./entity";
import { metaChecks } from "./meta";

export function runChecks(ctx: AuditContext): CheckResult[] {
  return [
    ...crawlabilityChecks(ctx),
    ...structuredDataChecks(ctx),
    ...contentChecks(ctx),
    ...entityChecks(ctx),
    ...metaChecks(ctx),
  ];
}
