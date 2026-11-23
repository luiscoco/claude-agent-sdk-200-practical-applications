import path from 'node:path';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { config } from 'dotenv';
import { calculateStatistics, parseNumbers, validateModelResult, LessonError } from './numbers.js';
import { runClaudeAgent } from './agent.js';
import type { AgentInput, AgentAnswer, Mode, Run, RunEvent, Report } from './types.js';

export class RunService {
  runs = new Map<string, Run>();
  constructor(private root: string, private agent: (input:AgentInput)=>Promise<AgentAnswer> = runClaudeAgent) {}

  start(mode: Mode, text: string): Run {
    const id = randomUUID();
    const run: Run = {id,mode,status:'running',events:[],controller:new AbortController(),listeners:new Set(),finished:Promise.resolve()};
    this.runs.set(id,run);
    run.finished = this.execute(run,text);
    return run;
  }

  private async execute(run: Run, text: string) {
    const directory = path.join(this.root,run.id),file = path.join(directory,'values.txt');
    await mkdir(directory,{recursive:true});
    const emit = async (type:string,title:string,detail:string,source?:string,data?:unknown) => {
      const event: RunEvent = {id:run.events.length+1,at:new Date().toISOString(),type,title,detail,source,data};
      run.events.push(event);
      await appendFile(path.join(directory,'events.jsonl'),JSON.stringify(event)+'\n','utf8');
      for (const listener of run.listeners) listener(event);
    };
    const timeout = setTimeout(()=>run.controller.abort(),180_000);timeout.unref();
    try {
      await emit('started','Run started',run.mode==='agent'?'Live Claude Agent SDK run.':'Local verification only. No Claude or model call.');
      await writeFile(file,text,'utf8');
      await emit('input_saved','Input file saved','A new values.txt was written for this run.','src/service.ts',{file:'values.txt',sha256:createHash('sha256').update(text).digest('hex')});
      const input = parseNumbers(text),expected = calculateStatistics(input);
      await emit('preflight_passed','Input validation passed',`${input.length} integers parsed. The application has an independent reference calculation.`,'src/numbers.ts');
      if (run.controller.signal.aborted) throw new LessonError('CANCELLED','Run cancelled.');
      config({quiet:true});
      const result = run.mode==='agent' ? await this.agent({file,directory,signal:run.controller.signal,emit}) : undefined;
      const actual = result ? validateModelResult(result.statistics,expected) : expected;
      if (run.controller.signal.aborted) throw new LessonError('CANCELLED','Run cancelled.');
      await emit('verified',result?'Independent verification passed':'Local calculation completed',result?'All four model statistics match the application’s independent calculation.':'These statistics were calculated by local code. No AI run is claimed.','src/numbers.ts',{expected,actual});
      const report: Report = {runId:run.id,mode:run.mode,createdAt:new Date().toISOString(),sourceFile:'values.txt',sourceSha256:createHash('sha256').update(text).digest('hex'),input,expected,actual,verified:true};
      if (result) report.agent = {model:result.model,sessionId:result.sessionId,estimatedCostUsd:result.estimatedCostUsd,readCalls:result.readCalls};
      await writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2),'utf8');
      await writeFile(path.join(directory,'report.md'),`# Verified number report\n\nMode: ${run.mode}\n\n| Statistic | Verified value |\n|---|---:|\n| Count | ${actual.count} |\n| Total | ${actual.total} |\n| Minimum | ${actual.min} |\n| Maximum | ${actual.max} |\n\nInput SHA-256: ${report.sourceSha256}\n\n${result?'Claude output matched an independent application calculation.':'Local verification only; no model was called.'}\n`,'utf8');
      run.report=report;
      await emit('report_saved','Verified report saved','report.json and report.md were written to this run’s folder.','src/service.ts');
      run.status='completed';
      await emit('completed','Run complete',result?'Read → observation → structured result → verified report.':'Local verifier complete. Select Live Claude agent to observe the SDK loop.');
    } catch (error) {
      const e = error instanceof LessonError ? error : new LessonError(run.controller.signal.aborted?'CANCELLED':'RUN_ERROR',error instanceof Error?error.message:'Unexpected run error.');
      const secret=process.env.ANTHROPIC_API_KEY;
      const message=(secret?e.message.replaceAll(secret,'[REDACTED]'):e.message).slice(0,800);
      run.status=e.code==='CANCELLED'?'cancelled':'failed';run.error={code:e.code,message,line:e.line};
      await emit(run.status,run.status==='cancelled'?'Run cancelled':'Run stopped',message,undefined,run.error);
      await writeFile(path.join(directory,'failure.json'),JSON.stringify(run.error,null,2),'utf8');
    } finally { clearTimeout(timeout); }
  }
}
