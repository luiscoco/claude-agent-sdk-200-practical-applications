import 'dotenv/config';
import { diagnoseRuntime } from './diagnostics.mjs';
try {
  const report = await diagnoseRuntime({language:process.argv.includes('--python')?'python':'typescript',missingBinary:process.argv.includes('--missing')});
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
