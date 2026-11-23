import path from 'node:path';
import {access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute=promisify(execFile);
export async function inspectPythonEnvironment(){
  const root=path.resolve(import.meta.dirname,'..');
  const interpreter=process.env.PYTHON_EXECUTABLE||path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  try{await access(interpreter);}catch{throw new Error('PYTHON_NOT_CONFIGURED · Create the project .venv and install requirements, or set PYTHON_EXECUTABLE to your configured interpreter.');}
  const result=await execute(interpreter,[path.join(root,'src/python_env.py')],{windowsHide:true,timeout:45000,maxBuffer:131072,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  return JSON.parse(result.stdout);
}
