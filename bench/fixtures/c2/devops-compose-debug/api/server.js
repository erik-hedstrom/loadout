const http = require('node:http');
const { Client } = require('pg');

const port = Number(process.env.PORT || 3000);
const db = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await db.connect().catch((err) => {
    console.log(JSON.stringify({ level: 50, msg: 'database connection failed', err: err.message }));
    process.exit(1);
  });
  await db.query('create table if not exists visits (at timestamptz default now())');
  http
    .createServer(async (req, res) => {
      if (req.url === '/healthz') {
        await db.query('select 1');
        res.end('ok');
        return;
      }
      await db.query('insert into visits default values');
      res.end('hello');
    })
    .listen(port, () => console.log(JSON.stringify({ level: 30, msg: 'server starting', port: String(port) })));
}

main();
