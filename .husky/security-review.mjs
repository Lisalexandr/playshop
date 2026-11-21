// Runs the security-reviewer agent on the staged diff and blocks the commit unless it returns a PASS verdict.
import { execFileSync, spawnSync } from 'node:child_process';

const schema = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['HIGH', 'MEDIUM'] },
          category: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          description: { type: 'string' },
          exploit_scenario: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'category', 'file', 'description', 'exploit_scenario', 'fix'],
      },
    },
  },
  required: ['verdict', 'summary', 'findings'],
};

const maxBuffer = 64 * 1024 * 1024;

const block = (reason, details) => {
  if (details) console.error(details);
  console.error(`security-review: ${reason}. Commit blocked (use --no-verify to bypass).`);
  process.exit(1);
};

const diff = execFileSync('git', ['diff', '--cached', '--no-color', '--', '.', ':(exclude)package-lock.json'], {
  encoding: 'utf8',
  maxBuffer,
});
if (!diff.trim()) process.exit(0);

const env = { ...process.env };
delete env.CLAUDECODE;

console.log('security-review: reviewing staged changes with the security-reviewer agent...');
const run = spawnSync(
  'claude',
  ['-p', '--agent', 'security-reviewer', '--no-session-persistence', '--output-format', 'json', '--json-schema', JSON.stringify(schema)],
  { input: `Review this staged diff (git diff --cached):\n\n${diff}\n`, encoding: 'utf8', env, maxBuffer },
);

if (run.error?.code === 'ENOENT') {
  console.log('security-review: claude CLI not found, skipping');
  process.exit(0);
}
if (run.error || run.status !== 0) block('review failed to run', run.error?.message ?? `${run.stdout}${run.stderr}`);

let review;
try {
  const out = JSON.parse(run.stdout);
  if (out.is_error) block(`review returned an error (${out.subtype})`, out.result);
  review = out.structured_output;
} catch {
  block('could not parse the review output', run.stdout);
}
if (!review || !['PASS', 'FAIL'].includes(review.verdict) || !Array.isArray(review.findings)) {
  block('no structured verdict returned', JSON.stringify(review));
}

console.log(review.summary);
for (const f of review.findings) {
  console.log(`\n[${f.severity}] ${f.category}: ${f.file}${f.line ? `:${f.line}` : ''}`);
  console.log(`  Description: ${f.description}`);
  console.log(`  Exploit scenario: ${f.exploit_scenario}`);
  console.log(`  Fix: ${f.fix}`);
}

if (review.verdict !== 'PASS' || review.findings.length > 0) {
  block(`verdict ${review.verdict} with ${review.findings.length} finding(s)`);
}
console.log('security-review: PASS');
