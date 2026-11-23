"""Ported contract: local is stdlib-only; live uses actual Claude Agent SDK."""
import asyncio
import json
import os
import sys

async def main():
    payload = json.loads(sys.argv[2])
    if payload.get('tenant') != 'alice' or payload.get('question') != 'delivery retry':
        raise ValueError('Unsupported classroom input')
    result = {'contract': {'tenant': payload['tenant'], 'evidenceId': 'D1', 'retryLimit': 3}}
    if sys.argv[1] == 'live':
        from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
        events = []
        async for event in query(prompt='Delivery jobs retry at most three times [D1]. State the limit and cite D1.', options=ClaudeAgentOptions(cwd=os.environ.get('LAB_WORKSPACE'), tools=[], setting_sources=[], max_turns=2, max_budget_usd=0.35, model=os.environ.get('CLAUDE_MODEL', 'claude-sonnet-4-6'))):
            if isinstance(event, ResultMessage):
                events.append({'subtype': event.subtype, 'is_error': event.is_error, 'result': event.result, 'cost': event.total_cost_usd})
        result['results'] = events
        result['liveSuccess'] = bool(events and not events[-1]['is_error'] and events[-1]['subtype'] == 'success' and 'D1' in (events[-1]['result'] or ''))
    print(json.dumps(result))

asyncio.run(main())
