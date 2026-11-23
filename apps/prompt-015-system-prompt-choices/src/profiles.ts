import type {Options} from '@anthropic-ai/claude-agent-sdk';

export const task = 'Briefly state your role, then translate "Good morning" into Spanish.';
export const customInstructions = [
  'You are a concise Spanish-language tutor.',
  'Begin your final answer exactly with TUTOR | followed by a space.',
  'State your teaching role briefly and provide the requested translation.'
].join(' ');

export function profileOptions(mode: string): Pick<Options, 'systemPrompt'> {
  if (mode === 'minimal') return {};
  if (mode === 'preset') {
    return {systemPrompt: {type: 'preset', preset: 'claude_code'}};
  }
  if (mode === 'custom') return {systemPrompt: customInstructions};
  throw new Error('INVALID_PROFILE · Select minimal, preset, or custom.');
}
