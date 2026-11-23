export function publicReport(report: unknown, values: Array<string | undefined>) {
  const secrets = values.filter((value): value is string => Boolean(value));
  let text = JSON.stringify(report);
  for (const secret of secrets) text = text.replaceAll(secret, '[REDACTED]');
  return {
    ...JSON.parse(text),
    privacyChecks: { credentialValuesAbsent: secrets.every((secret) => !text.includes(secret)) },
  };
}
