// Cloudflare Worker: posts a random standup presenter to Slack on a cron schedule.
// Secrets (set with `wrangler secret put`): SLACK_WEBHOOK_URL, TEAM_JSON
// TEAM_JSON looks like: {"members":[{"name":"Alice","slackId":"U0123"}]}

const pragueHour = (date) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', hourCycle: 'h23' }).format(date));

export async function pickAndPost(env) {
  const { members } = JSON.parse(env.TEAM_JSON);
  const pick = members[crypto.getRandomValues(new Uint32Array(1))[0] % members.length];
  const url = env.SLACK_WEBHOOK_URL;

  // Workflow Builder webhooks (/triggers/) take the variables you defined; classic webhooks take "text"
  const payload = url.includes('/triggers/')
    ? { presenter: pick.name, presenter_user: pick.slackId }
    : { text: `:microphone: Today's standup presenter is ${pick.slackId ? `<@${pick.slackId}>` : `*${pick.name}*`}! :tada:` };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  console.log(`Picked: ${pick.name}; Slack responded ${res.status}: ${body}`);
  if (!res.ok) throw new Error(`Slack returned ${res.status}: ${body}`);
  return pick.name;
}

export default {
  // Two crons (08:00 and 09:00 UTC, Mon-Thu) cover summer and winter time;
  // only the one that lands on 10:xx Prague time posts.
  async scheduled(event, env, ctx) {
    const hour = pragueHour(new Date(event.scheduledTime));
    if (hour !== 10) {
      console.log(`Prague hour is ${hour}, not 10, skipping`);
      return;
    }
    ctx.waitUntil(pickAndPost(env));
  },

  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
