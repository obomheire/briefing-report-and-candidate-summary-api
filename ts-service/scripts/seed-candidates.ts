/**
 * Seed script: inserts workspace-1 and 10 candidates into the database.
 * Usage (from ts-service/): npm run seed
 */

import { Client } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://assessment_user:assessment_pass@localhost:5432/assessment_db';

const WORKSPACE_ID = 'workspace-1';

const CANDIDATES = [
  { id: 'candidate-1',  fullName: 'Alice Johnson', email: 'alice.johnson@example.com' },
  { id: 'candidate-2',  fullName: 'Bob Martinez',  email: 'bob.martinez@example.com' },
  { id: 'candidate-3',  fullName: 'Carol White',   email: 'carol.white@example.com' },
  { id: 'candidate-4',  fullName: 'David Kim',     email: 'david.kim@example.com' },
  { id: 'candidate-5',  fullName: 'Eva Patel',     email: 'eva.patel@example.com' },
  { id: 'candidate-6',  fullName: 'Frank Lee',     email: 'frank.lee@example.com' },
  { id: 'candidate-7',  fullName: 'Grace Chen',    email: 'grace.chen@example.com' },
  { id: 'candidate-8',  fullName: 'Henry Brown',   email: 'henry.brown@example.com' },
  { id: 'candidate-9',  fullName: 'Isla Davis',    email: 'isla.davis@example.com' },
  { id: 'candidate-10', fullName: 'James Wilson',  email: 'james.wilson@example.com' },
];

async function seed(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO sample_workspaces (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [WORKSPACE_ID, 'Test Workspace'],
    );

    for (const c of CANDIDATES) {
      await client.query(
        `INSERT INTO sample_candidates (id, workspace_id, full_name, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, WORKSPACE_ID, c.fullName, c.email],
      );
      console.log(`  ✓ ${c.id} — ${c.fullName}`);
    }

    await client.query('COMMIT');
    console.log(`\nSeeded ${CANDIDATES.length} candidates into workspace "${WORKSPACE_ID}".`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
