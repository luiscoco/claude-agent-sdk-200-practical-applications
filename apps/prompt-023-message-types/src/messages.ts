import type {SDKMessage} from '@anthropic-ai/claude-agent-sdk';

export type ObservedEvent = {
  frame:number; messageType:string; kind:'system'|'assistant'|'user'|'tool-use'|'tool-result'|'result';
  title:string; text:string; toolUseId?:string; isError?:boolean;
};

export function classifyMessage(message: SDKMessage, frame: number): ObservedEvent[] {
  const base = {frame,messageType:message.type};
  switch (message.type) {
    case 'system':
      return [{...base,kind:'system',title:message.subtype,
        text:message.subtype === 'init' ? JSON.stringify({model:message.model,tools:message.tools,nativeVersion:message.claude_code_version},null,2)
          : 'content' in message && typeof message.content === 'string' ? message.content : message.subtype}];
    case 'assistant':
      return message.message.content.flatMap((block):ObservedEvent[] => {
        if (block.type === 'text') return [{...base,kind:'assistant',title:'Assistant text',text:block.text}];
        if (block.type === 'tool_use') return [{...base,kind:'tool-use',title:block.name,text:JSON.stringify(block.input,null,2),toolUseId:block.id}];
        return [];
      });
    case 'user': {
      const content = message.message.content;
      if (typeof content === 'string') return [{...base,kind:'user',title:'User text',text:content}];
      return content.flatMap((block):ObservedEvent[] => {
        if (block.type === 'text') return [{...base,kind:'user',title:'User text',text:block.text}];
        if (block.type === 'tool_result') return [{...base,kind:'tool-result',title:'Tool result inside user message',
          text:typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? null,null,2),
          toolUseId:block.tool_use_id,isError:block.is_error ?? false}];
        return [];
      });
    }
    case 'result':
      return [{...base,kind:'result',title:message.subtype,isError:message.is_error,
        text:message.subtype === 'success' ? message.result : message.errors.join('\n')}];
    default:
      return [];
  }
}

export function correlateTools(events: ObservedEvent[]) {
  const requests = events.filter(event => event.kind === 'tool-use');
  return events.filter(event => event.kind === 'tool-result').map(result => ({
    toolUseId:result.toolUseId,requestFrame:requests.find(request => request.toolUseId === result.toolUseId)?.frame ?? null,
    resultFrame:result.frame,isError:result.isError ?? false
  }));
}
