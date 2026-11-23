import {inspectTypeScriptEnvironment} from './typescript.js';

try{console.log(JSON.stringify(await inspectTypeScriptEnvironment(!process.argv.includes('--replace')),null,2));}
catch(error){console.error(error instanceof Error?error.message:'Environment experiment failed.');process.exitCode=1;}
