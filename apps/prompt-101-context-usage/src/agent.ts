import { requestSchema } from './context-view.js';
import { measureContext } from './native-context.js';
import { publicReport } from './privacy.js';
export async function runContextUsage(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  const selected: Array<'baseline' | 'short' | 'long'> =
    requestedInput.mode === 'compare' ? ['baseline', 'short', 'long'] : [requestedInput.mode];
  const profiles = [];
  for (const profile of selected)
    profiles.push(await measureContext(profile, requestedInput.topic));
  const checks = {
    allExpectedNativeProfilesRan: profiles.length === selected.length,
    allActualNativeContextChecksPassed: profiles.every((profile) => profile.verified),
    freshProfileSessionsAreDistinct:
      new Set(profiles.map((profile) => profile.command.actualSessionId)).size === profiles.length,
    largerOwnedHistoryIncreasesMeasuredUsage:
      requestedInput.mode !== 'compare' ||
      (profiles[0].view.usedTokens < profiles[1].view.usedTokens &&
        profiles[1].view.usedTokens < profiles[2].view.usedTokens),
  };
  return publicReport(
    {
      requestedInput,
      profiles,
      output: {
        profiles: profiles.length,
        observedUsedTokens: profiles.map((profile) => ({
          profile: profile.profile,
          tokens: profile.view.usedTokens,
        })),
        nativeAssistantModelTurns: profiles.reduce(
          (sum, profile) => sum + profile.command.turns,
          0,
        ),
        nativeModelCostUsd: profiles.reduce(
          (sum, profile) => sum + profile.command.costUsd + (profile.seeded?.costUsd ?? 0),
          0,
        ),
      },
      fixtureDisclosure:
        'Fresh owned synthetic classroom records. Context is appended with shouldQuery:false, then the actual local /context command returns its structured context_usage estimates. No assistant model inference. Only categories actually returned by this local report are displayed; this is not a full inference-prompt or billing-token benchmark.',
      checks,
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
