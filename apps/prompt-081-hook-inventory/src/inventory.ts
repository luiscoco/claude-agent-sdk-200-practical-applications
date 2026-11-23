import { HOOK_EVENTS } from '@anthropic-ai/claude-agent-sdk';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const examples: Record<string, { when: string; useCase: string }> = {
  PreToolUse: {
    when: 'Before a tool operation',
    useCase: 'Validate the owned classroom file path before Read executes.',
  },
  PostToolUse: {
    when: 'After a successful operation',
    useCase: 'Attach the completed file operation to its audit record.',
  },
  PostToolUseFailure: {
    when: 'After an operation fails',
    useCase: 'Show the native failure beside the correction exercise.',
  },
  PostToolBatch: {
    when: 'After a tool batch',
    useCase: 'Add one concise completion summary for a finished batch.',
  },
  Notification: {
    when: 'When a notification arrives',
    useCase: 'Display an operator status notification in the lesson interface.',
  },
  UserPromptSubmit: {
    when: 'When a prompt is submitted',
    useCase: 'Associate the submitted classroom task with its lesson identifier.',
  },
  UserPromptExpansion: {
    when: 'When a command expands',
    useCase: 'Inspect a typed lesson command before its expanded prompt is used.',
  },
  SessionStart: {
    when: 'At session startup or resume',
    useCase: 'Attach a classroom run identifier when the native session starts.',
  },
  SessionEnd: {
    when: 'At session termination',
    useCase: 'Release resources owned by the completed classroom session.',
  },
  Stop: {
    when: 'When a response finishes',
    useCase: 'Save the completed lesson response for instructor review.',
  },
  StopFailure: {
    when: 'When an API failure ends a turn',
    useCase: 'Record the failed turn so the learner can inspect its API error.',
  },
  SubagentStart: {
    when: 'When a subagent starts',
    useCase: 'Associate a delegated task with its parent classroom run.',
  },
  SubagentStop: {
    when: 'When a subagent finishes',
    useCase: 'Collect a finished delegated task into the parent review panel.',
  },
  PreCompact: {
    when: 'Before context compaction',
    useCase: 'Save essential task facts before the conversation is compacted.',
  },
  PostCompact: {
    when: 'After context compaction',
    useCase: 'Compare retained task facts with the saved precompaction snapshot.',
  },
  PreModelSwitch: {
    when: 'Before a requested model switch',
    useCase: 'Check the requested model against the classroom configuration.',
  },
  PostModelSwitch: {
    when: 'After a model switch',
    useCase: 'Update the interface with the actual active model.',
  },
  PermissionRequest: {
    when: 'When permission is needed',
    useCase: 'Open the operator approval panel for the actual pending request.',
  },
  PermissionDenied: {
    when: 'When auto mode denies a call',
    useCase: 'Show an auto-mode denial beside the attempted operation.',
  },
  Setup: {
    when: 'During explicit setup',
    useCase: 'Prepare a synthetic classroom fixture during one-time initialization.',
  },
  TeammateIdle: {
    when: 'When a teammate becomes idle',
    useCase: 'Record which team task is ready for the next classroom assignment.',
  },
  TaskCreated: {
    when: 'When a task is created',
    useCase: 'Tag a newly created task with its lesson and exercise identifiers.',
  },
  TaskCompleted: {
    when: 'When a task completes',
    useCase: 'Check that the expected classroom artifact exists before accepting completion.',
  },
  Elicitation: {
    when: 'When MCP requests user input',
    useCase: 'Render the actual MCP form in the classroom question panel.',
  },
  ElicitationResult: {
    when: 'After an elicitation answer',
    useCase: 'Inspect a submitted MCP answer before forwarding its result.',
  },
  ConfigChange: {
    when: 'When configuration changes',
    useCase: 'Refresh the visible classroom configuration after a settings change.',
  },
  WorktreeCreate: {
    when: 'When a worktree is created',
    useCase: 'Provision an owned workspace for an isolated classroom exercise.',
  },
  WorktreeRemove: {
    when: 'When a worktree is removed',
    useCase: 'Clean up resources belonging to that exercise worktree.',
  },
  InstructionsLoaded: {
    when: 'When instruction files load',
    useCase: 'Show which instruction files contributed to the current session.',
  },
  CwdChanged: {
    when: 'When the working directory changes',
    useCase: 'Update the classroom file explorer to the active directory.',
  },
  FileChanged: {
    when: 'When a watched file changes',
    useCase: 'Refresh the preview of the owned classroom note.',
  },
  DirectoryAdded: {
    when: 'When a directory is added',
    useCase: 'Update the interface with the newly available workspace root.',
  },
  MessageDisplay: {
    when: 'When an assistant message displays',
    useCase: 'Format the completed assistant message for the lesson transcript.',
  },
};
export async function installedInventory() {
  const require = createRequire(import.meta.url);
  const moduleFile = require.resolve('@anthropic-ai/claude-agent-sdk');
  const packageFile = path.join(path.dirname(moduleFile), 'package.json');
  const metadata = JSON.parse(await readFile(packageFile, 'utf8'));
  const hooks = HOOK_EVENTS.map((name) => ({
    name,
    ...examples[name],
    hasUseCase: Boolean(examples[name]),
  }));
  return {
    sdkVersion: metadata.version,
    inventorySource: 'The installed @anthropic-ai/claude-agent-sdk HOOK_EVENTS export',
    count: hooks.length,
    hooks,
    unmappedEvents: hooks.filter((hook) => !hook.hasUseCase).map((hook) => hook.name),
  };
}
