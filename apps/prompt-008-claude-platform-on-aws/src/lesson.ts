import { providerRun } from './provider.js';
export async function run(mode: string) { return providerRun('anthropic-aws', mode); }
