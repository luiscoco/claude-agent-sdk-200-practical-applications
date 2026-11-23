import type {SDKResultMessage} from '@anthropic-ai/claude-agent-sdk';

export type ApplicationOutcome = {
  ok:boolean; category:'success'|'sdk-result-error'|'exception';
  message:string; answer:string|null; resultSubtype:string|null;
  resultIsError:boolean|null; exceptionName:string|null;
};

export function completionOutcome(message: SDKResultMessage): ApplicationOutcome {
  if (message.subtype === 'success' && !message.is_error) {
    return {ok:true,category:'success',message:'The SDK query completed successfully.',answer:message.result,
      resultSubtype:message.subtype,resultIsError:message.is_error,exceptionName:null};
  }
  const detail = message.subtype === 'success' ? message.result : message.errors.join('\n');
  return {ok:false,category:'sdk-result-error',message:detail || message.subtype,answer:null,
    resultSubtype:message.subtype,resultIsError:message.is_error,exceptionName:null};
}

export function exceptionOutcome(error: unknown): ApplicationOutcome {
  return {ok:false,category:'exception',message:error instanceof Error ? error.message : String(error),answer:null,
    resultSubtype:null,resultIsError:null,exceptionName:error instanceof Error ? error.name : 'ThrownValue'};
}
