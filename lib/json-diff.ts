export type JsonDiffItem = {
  fieldPath: string;
  before: unknown;
  after: unknown;
  changeType: "add" | "update" | "delete";
};

export function diffJson(
  before: unknown,
  after: unknown,
  basePath = "",
): JsonDiffItem[] {
  if (Object.is(before, after)) {
    return [];
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]);

    return [...keys].flatMap((key) => {
      const nextPath = basePath ? `${basePath}.${key}` : key;

      if (!(key in before)) {
        return [{
          fieldPath: nextPath,
          before: undefined,
          after: after[key],
          changeType: "add" as const,
        }];
      }

      if (!(key in after)) {
        return [{
          fieldPath: nextPath,
          before: before[key],
          after: undefined,
          changeType: "delete" as const,
        }];
      }

      return diffJson(before[key], after[key], nextPath);
    });
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);

    return Array.from({ length: maxLength }).flatMap((_, index) => {
      const nextPath = `${basePath}[${index}]`;

      if (index >= before.length) {
        return [{
          fieldPath: nextPath,
          before: undefined,
          after: after[index],
          changeType: "add" as const,
        }];
      }

      if (index >= after.length) {
        return [{
          fieldPath: nextPath,
          before: before[index],
          after: undefined,
          changeType: "delete" as const,
        }];
      }

      return diffJson(before[index], after[index], nextPath);
    });
  }

  return [{
    fieldPath: basePath,
    before,
    after,
    changeType: "update",
  }];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
