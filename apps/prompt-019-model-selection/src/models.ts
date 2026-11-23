export type CatalogModel = {id:string; display_name:string; created_at:string; lifecycle?:string};
export const defaultModel = 'claude-sonnet-4-6';
export const missingModel = 'claude-course-missing-model';

export function validateModel(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:[\]-]{0,199}$/.test(value)) {
    throw new Error('INVALID_MODEL · Enter a model identifier or supported alias.');
  }
  return value;
}

export async function listModels(apiKey = process.env.ANTHROPIC_API_KEY) {
  if (!apiKey?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const models: CatalogModel[] = [];
  let cursor = '';
  do {
    const url = new URL('https://api.anthropic.com/v1/models');
    url.searchParams.set('limit', '1000');
    if (cursor) url.searchParams.set('after_id', cursor);
    const response = await fetch(url, {
      headers:{'x-api-key':apiKey, 'anthropic-version':'2023-06-01'},
      signal:AbortSignal.timeout(30000)
    });
    const body = await response.json() as {data?:CatalogModel[]; has_more?:boolean; last_id?:string; error?:{message?:string}};
    if (!response.ok) throw new Error('CATALOG_ERROR · HTTP '+response.status+' · '+(body.error?.message || 'Model discovery failed.'));
    if (!Array.isArray(body.data)) throw new Error('CATALOG_ERROR · The response omitted its model list.');
    models.push(...body.data.map(model => ({id:model.id, display_name:model.display_name, created_at:model.created_at, lifecycle:model.lifecycle})));
    const next = body.has_more ? body.last_id : '';
    if (body.has_more && (!next || next === cursor)) throw new Error('CATALOG_ERROR · Invalid pagination cursor.');
    cursor = next || '';
  } while (cursor);
  return {provider:'Anthropic API', checkedAt:new Date().toISOString(), models};
}
