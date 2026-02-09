import yaml from 'js-yaml';

type ChangeRecord = {
  field: string;
  from: unknown;
  to: unknown;
};

/**
 * Compare two objects and return the differences
 */
export function compareObjects(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown> | null,
  prefix = ''
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

  for (const key of allKeys) {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    const oldValue = oldObj?.[key];
    const newValue = newObj?.[key];

    // Skip if both are undefined/null
    if (oldValue == null && newValue == null) continue;

    // Skip certain fields
    if (['id', 'createdAt', 'updatedAt', 'lastUpdated'].includes(key)) continue;

    // Handle different types
    if (typeof oldValue !== typeof newValue) {
      changes.push({ field: fieldName, from: oldValue, to: newValue });
    } else if (typeof oldValue === 'object' && oldValue !== null && newValue !== null) {
      // Recurse for nested objects (but not arrays)
      if (!Array.isArray(oldValue) && !Array.isArray(newValue)) {
        changes.push(
          ...compareObjects(oldValue as Record<string, unknown>, newValue as Record<string, unknown>, fieldName)
        );
      } else {
        // For arrays, just compare as values
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({ field: fieldName, from: oldValue, to: newValue });
        }
      }
    } else if (oldValue !== newValue) {
      changes.push({ field: fieldName, from: oldValue, to: newValue });
    }
  }

  return changes;
}

/**
 * Format changes as YAML for audit trail
 */
export function formatChangesAsYaml(changes: ChangeRecord[]): string {
  if (changes.length === 0) return 'No changes detected';

  const changeObj: Record<string, { from: unknown; to: unknown }> = {};

  for (const change of changes) {
    changeObj[change.field] = {
      from: change.from ?? null,
      to: change.to ?? null,
    };
  }

  return yaml.dump(changeObj, {
    sortKeys: true,
    lineWidth: -1, // Don't wrap lines
    noRefs: true,
  });
}

/**
 * Create an audit comment content
 */
export function createAuditComment(_userName: string, action: string, changes: ChangeRecord[]): string {
  const yamlChanges = formatChangesAsYaml(changes);

  // For creation, just show the action
  if (action === 'created church' || action === 'created') {
    return 'Created';
  }

  // For updates, show what changed
  if (changes.length === 0) {
    return 'Updated';
  }

  return `Updated\n\n\`\`\`yaml\n${yamlChanges}\n\`\`\``;
}

/**
 * Compare church data including related entities
 */
export function compareChurchData(
  oldChurch: Record<string, unknown>,
  newChurch: Record<string, unknown>,
  oldGatherings: Array<Record<string, unknown>> = [],
  newGatherings: Array<Record<string, unknown>> = [],
  oldAffiliations: Array<Record<string, unknown>> = [],
  newAffiliations: Array<Record<string, unknown>> = []
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];

  // Compare main church fields
  changes.push(...compareObjects(oldChurch, newChurch));

  // Compare gatherings
  const oldGatheringStrs = oldGatherings.map((g) => `${g.time}${g.notes ? ` - ${g.notes}` : ''}`).sort();
  const newGatheringStrs = newGatherings.map((g) => `${g.time}${g.notes ? ` - ${g.notes}` : ''}`).sort();

  if (JSON.stringify(oldGatheringStrs) !== JSON.stringify(newGatheringStrs)) {
    changes.push({
      field: 'gatherings',
      from: oldGatheringStrs,
      to: newGatheringStrs,
    });
  }

  // Compare affiliations
  const oldAffiliationNames = oldAffiliations.map((a) => a.name).sort();
  const newAffiliationNames = newAffiliations.map((a) => a.name).sort();

  if (JSON.stringify(oldAffiliationNames) !== JSON.stringify(newAffiliationNames)) {
    changes.push({
      field: 'affiliations',
      from: oldAffiliationNames,
      to: newAffiliationNames,
    });
  }

  return changes;
}
