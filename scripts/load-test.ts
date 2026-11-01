/**
 * Load Test Script for Email Scheduler
 * Schedules 1,000+ emails for the same start time with a low hourly limit,
 * demonstrating atomic rate limiting, sender rotation, and automatic spillover
 * into the next hourly window without dropping or failing any jobs.
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const TOTAL_EMAILS = parseInt(process.env.LOAD_TEST_COUNT || '1050', 10);
const HOURLY_LIMIT = parseInt(process.env.LOAD_TEST_LIMIT || '20', 10);

async function runLoadTest() {
  console.log(`\n==================================================`);
  console.log(`🚀 Starting Load Test: Scheduling ${TOTAL_EMAILS} emails`);
  console.log(`⚙️  Target URL: ${BACKEND_URL}`);
  console.log(`⚡ Hourly Limit: ${HOURLY_LIMIT} emails/hr`);
  console.log(`==================================================\n`);

  try {
    // 1. Authenticate / Dev Login
    console.log(`Logging in user Oliver Brown...`);
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'oliver.brown@domain.io',
        name: 'Oliver Brown',
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed with status ${loginRes.status}`);
    }

    const loginData = (await loginRes.json()) as any;
    const token = loginData.token;
    console.log(`Authenticated! User ID: ${loginData.user.id}`);

    // 2. Generate recipients
    console.log(`Generating ${TOTAL_EMAILS} mock recipient emails...`);
    const recipients: string[] = [];
    for (let i = 1; i <= TOTAL_EMAILS; i++) {
      recipients.push(`lead_${i}_${Date.now()}@testcompany.org`);
    }

    // 3. Schedule Campaign
    const startTime = new Date(Date.now() + 2000).toISOString();
    console.log(`Submitting scheduling request for ${TOTAL_EMAILS} leads...`);
    const startTimePerf = Date.now();

    const scheduleRes = await fetch(`${BACKEND_URL}/api/emails/schedule`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Q4 Product Demo & Partnership Opportunity',
        body: '<p>Hi there! We would love to share our upcoming Q4 roadmap with you.</p>',
        recipients,
        startTime,
        delayBetweenSec: 1,
        hourlyLimit: HOURLY_LIMIT,
      }),
    });

    if (!scheduleRes.ok) {
      const errText = await scheduleRes.text();
      throw new Error(`Schedule API failed: ${errText}`);
    }

    const scheduleData = (await scheduleRes.json()) as any;
    const durationMs = Date.now() - startTimePerf;
    console.log(`\n✅ Successfully scheduled ${scheduleData.totalScheduled} emails in ${durationMs}ms!`);
    console.log(`Campaign ID: ${scheduleData.campaignId}`);
    console.log(`First Scheduled At: ${scheduleData.firstScheduledAt}`);
    console.log(`Last Scheduled At: ${scheduleData.lastScheduledAt}`);

    console.log(`\n📈 Live Queue Dashboard: ${BACKEND_URL}/admin/queues (Basic Auth: admin / adminsecret)`);
    console.log(`\nObserving dispatch progress:`);
    console.log(`- Up to ${HOURLY_LIMIT} emails per active sender will send in the current hour window.`);
    console.log(`- Remaining ~${TOTAL_EMAILS - HOURLY_LIMIT} emails will automatically spill over to the start of the next hour window preserving queue order.`);
    console.log(`\nLoad test setup complete!\n`);
  } catch (err: any) {
    console.error(`❌ Load test failed:`, err.message);
    process.exit(1);
  }
}

runLoadTest();
