const fs = require('node:fs');
let text = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (text += chunk));
process.stdin.on('end', () => {
  fs.appendFileSync(
    process.argv[2],
    JSON.stringify({ input: JSON.parse(text), observedAt: new Date().toISOString() }) + '\n',
  );
  process.stdout.write('{}');
});
