import {inspectSettings} from './settings.js';

try{
  const mode=process.argv[2]||'default';
  console.log(JSON.stringify(await inspectSettings(mode),null,2));
}catch(error){console.error(error instanceof Error?error.message:'Settings inspection failed.');process.exitCode=1;}
