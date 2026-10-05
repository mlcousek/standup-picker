// Standup presenter picker (runs in GitHub Actions, no dependencies, no memory).
// Picks a fully random member each run, so the same person can come up twice in a row.
//
// Usage: node standup.mjs            (pick + post to SLACK_WEBHOOK_URL if set)
//        node standup.mjs --dry-run  (pick only)
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

const dryRun = process.argv.includes('--dry-run');
const teamJson = process.env.TEAM_JSON || readFileSync(new URL('./team.json', import.meta.url), 'utf8');
const { members } = JSON.parse(teamJson);

const pick = members[randomInt(members.length)];
const mention = pick.slackId ? `<@${pick.slackId}>` : `*${pick.name}*`;
const text = `:microphone: Today's standup presenter is ${mention}! :tada:`;
console.log(`Picked: ${pick.name}`);

const url = process.env.SLACK_WEBHOOK_URL;
if (dryRun || !url) {
  if (!url) console.log('(SLACK_WEBHOOK_URL not set, not posting)');
  process.exit(0);
}
// Workflow Builder webhooks (/triggers/) take the variables you defined; classic webhooks take "text"
const payload = url.includes('/triggers/') ? { presenter: pick.name, presenter_user: pick.slackId } : { text };
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log(`Slack responded ${res.status}: ${await res.text()}`);
if (!res.ok) process.exit(1);
