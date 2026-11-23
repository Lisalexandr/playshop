// Runs playwright-reviewer on test changes and code-reviewer on all other changes in the commits being pushed,
// and blocks the push if either review reports a Blocker.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const schema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['Blocker', 'Major', 'Minor', 'Nit'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          title: { type: 'string' },
          why: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'title', 'why', 'fix'],
      },
    },
  },
  required: ['summary', 'findings'],
};

const TEST_PATHS = ['tests', 'playwright.config.ts'];
const reviews = [
  { agent: 'playwright-reviewer', pathspec: TEST_PATHS },
  {
    agent: 'code-reviewer',
    pathspec: ['.', ...TEST_PATHS.map((p) => `:(exclude)${p}`), ':(exclude)package-lock.json'],
  },
];
const allowedTools = ['Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git status:*)', 'Bash(npx tsc --noEmit)'];

const maxBuffer = 64 * 1024 * 1024;
const isZero = (sha) => /^0+$/.test(sha);
const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer });
const isKnownCommit = (sha) => spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`]).status === 0;

const block = (reason, details) => {
  if (details) console.error(details);
  console.error(`agent-review: ${reason}. Push blocked (use --no-verify to bypass).`);
  process.exit(1);
};

// git passes "<local ref> <local sha> <remote ref> <remote sha>" for each pushed ref on stdin.
const ranges = [];
for (const line of readFileSync(0, 'utf8').split('\n')) {
  const [, localSha, , remoteSha] = line.trim().split(/\s+/);
  if (!localSha || isZero(localSha)) continue;
  let base = remoteSha;
  if (!remoteSha || isZero(remoteSha) || !isKnownCommit(remoteSha)) {
    try {
      base = git(['merge-base', localSha, 'origin/master']).trim();
    } catch {
      console.log(`agent-review: no merge base with origin/master for ${localSha.slice(0, 7)}, skipping`);
      continue;
    }
  }
  ranges.push(`${base}...${localSha}`);
}

const env = { ...process.env };
delete env.CLAUDECODE;

let blockers = 0;
for (const { agent, pathspec } of reviews) {
  const diff = ranges.map((range) => git(['diff', '--no-color', range, '--', ...pathspec])).join('');
  if (!diff.trim()) continue;

  console.log(`agent-review: reviewing pushed changes with the ${agent} agent...`);
  const run = spawnSync(
    'claude',
    [
      '-p',
      '--agent',
      agent,
      '--no-session-persistence',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(schema),
      '--permission-mode',
      'dontAsk',
      '--allowedTools',
      ...allowedTools,
    ],
    { input: `Review this diff of the commits being pushed:\n\n${diff}\n`, encoding: 'utf8', env, maxBuffer },
  );

  if (run.error?.code === 'ENOENT') {
    console.log('agent-review: claude CLI not found, skipping');
    process.exit(0);
  }
  if (run.error || run.status !== 0) block(`${agent} failed to run`, run.error?.message ?? `${run.stdout}${run.stderr}`);

  let review;
  try {
    const out = JSON.parse(run.stdout);
    if (out.is_error) block(`${agent} returned an error (${out.subtype})`, out.result);
    review = out.structured_output;
  } catch {
    block(`could not parse the ${agent} output`, run.stdout);
  }
  if (!review || !Array.isArray(review.findings)) block(`${agent} returned no structured review`, JSON.stringify(review));

  console.log(`\n${agent}: ${review.summary}`);
  for (const f of review.findings) {
    console.log(`\n[${f.severity}] ${f.file}${f.line ? `:${f.line}` : ''} — ${f.title}`);
    console.log(`  Why: ${f.why}`);
    console.log(`  Fix: ${f.fix}`);
  }
  blockers += review.findings.filter((f) => f.severity === 'Blocker').length;
}

if (blockers > 0) block(`${blockers} Blocker finding(s)`);
console.log('agent-review: no Blocker findings');
