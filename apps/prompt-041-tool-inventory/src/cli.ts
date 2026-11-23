import 'dotenv/config';
import { inspectInventory, executeExample } from './agent.js';
const inventory = await inspectInventory(process.argv[2] || 'scoped');
const report = inventory.verified
  ? await executeExample(inventory)
  : { inventory, verified: false };
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
