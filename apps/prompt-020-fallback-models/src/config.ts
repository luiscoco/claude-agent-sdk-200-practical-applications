export const primaryModel = 'claude-course-missing-model';
export const backupModel = 'claude-sonnet-4-6';
export const secondBackup = 'claude-haiku-4-5-20251001';

export function modelOptions(model: string, backups: string[]) {
  if (backups.includes(model)) throw new Error('INVALID_FALLBACK · Select distinct primary and backup models.');
  return backups.length ? {model, fallbackModel:backups.join(',')} : {model};
}

export function configuration(mode: unknown) {
  if (mode === 'fallback') return modelOptions(primaryModel,[backupModel]);
  if (mode === 'chain') return modelOptions(primaryModel,['claude-course-missing-backup',backupModel]);
  if (mode === 'disabled') return modelOptions(primaryModel,[]);
  if (mode === 'healthy') return modelOptions(backupModel,[secondBackup]);
  if (mode === 'invalid') return modelOptions(backupModel,[backupModel]);
  throw new Error('INVALID_MODE · Select fallback, chain, disabled, or healthy.');
}
