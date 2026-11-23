import {inspectTypeScriptEnvironment} from './typescript.js';
import {inspectPythonEnvironment} from './python.js';

export async function runEnvironmentExperiment(mode:string){
  if(!['typescript-replace','typescript-preserve','python-merge'].includes(mode))throw new Error('INVALID_MODE · Select one of the supported environment experiments.');
  return mode==='python-merge'?inspectPythonEnvironment():inspectTypeScriptEnvironment(mode==='typescript-preserve');
}
