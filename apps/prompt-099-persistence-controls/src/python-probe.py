import asyncio
import dataclasses
import importlib.metadata
import json
import os
import tempfile
import uuid
import sys
from pathlib import Path
from claude_agent_sdk import (
    ClaudeAgentOptions,
    query,
    SystemMessage,
    ResultMessage,
    AssistantMessage,
)

ROOT = Path(__file__).resolve().parents[1]

async def run():
    os.environ.pop('CLAUDE_CODE_SKIP_PROMPT_HISTORY', None)
    profile = sys.argv[1] if len(sys.argv) > 1 else 'default'
    topic = sys.argv[2] if len(sys.argv) > 2 else 'MCP'
    if profile not in ('default', 'disabled') or topic not in ('MCP', 'Hooks'):
        raise ValueError('Choose a supported persistence profile and classroom topic.')
    skip_history = profile == 'disabled'
    (ROOT / 'runs').mkdir(exist_ok=True)
    workspace = Path(tempfile.mkdtemp(prefix='python-', dir=ROOT / 'runs'))
    session_id, prompt_id = str(uuid.uuid4()), str(uuid.uuid4())
    marker = 'OWNED_PERSISTENCE_' + topic + '_' + str(uuid.uuid4())
    (workspace / 'owned-note.txt').write_text('Separate host-created classroom file. Native transcript persistence does not control this file.', encoding='utf-8')
    fields = {field.name for field in dataclasses.fields(ClaudeAgentOptions)}
    env = {'CLAUDE_CONFIG_DIR': str(workspace / 'native-config')}
    if skip_history:
        env['CLAUDE_CODE_SKIP_PROMPT_HISTORY'] = '1'
    kwargs = dict(
        cwd=str(workspace),
        tools=[],
        setting_sources=[],
        session_id=session_id,
        env=env,
        model='claude-sonnet-4-6',
    )
    if 'strict_mcp_config' in fields:
        kwargs['strict_mcp_config'] = True
    else:
        kwargs['extra_args'] = {'strict-mcp-config': None}
    async def prompts():
        yield {
            'type': 'user',
            'uuid': prompt_id,
            'message': {'role': 'user', 'content': marker},
            'parent_tool_use_id': None,
            'shouldQuery': False,
        }
    events, error, assistant_count = [], '', 0
    init, result = None, None
    async def collect():
        nonlocal init, result, assistant_count
        async for message in query(prompt=prompts(), options=ClaudeAgentOptions(**kwargs)):
            events.append({'class': type(message).__name__, 'data': dataclasses.asdict(message)})
            if isinstance(message, SystemMessage) and message.subtype == 'init':
                init = message.data
            elif isinstance(message, ResultMessage):
                result = dataclasses.asdict(message)
            elif isinstance(message, AssistantMessage):
                assistant_count += 1
    try:
        await asyncio.wait_for(collect(), timeout=45)
    except Exception as failure:
        error = str(failure)
    init, result = init or {}, result or {}
    return dict(
        language='Python',
        sdkVersion=importlib.metadata.version('claude-agent-sdk'),
        nativeVersion=init.get('claude_code_version'),
        control='CLAUDE_CODE_SKIP_PROMPT_HISTORY=1' if skip_history else 'SDK default · history env flag omitted',
        persistenceExpected=not skip_history,
        workspace=str(workspace),
        nativeConfigDirectory=str(workspace / 'native-config'),
        requestedSessionId=session_id,
        promptId=prompt_id,
        marker=marker,
        shouldQuery=False,
        actualSessionId=init.get('session_id'),
        actualResultSessionId=result.get('session_id'),
        success=result.get('subtype') == 'success' and not result.get('is_error'),
        turns=result.get('num_turns'),
        costUsd=result.get('total_cost_usd'),
        durationApiMs=result.get('duration_api_ms'),
        assistantMessageCount=assistant_count,
        firstClassPersistOption='persist_session' in fields,
        events=events,
        error=error,
    )

print(json.dumps(asyncio.run(run())), flush=True)
