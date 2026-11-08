import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config/index.js';
import { createDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';

const config = loadConfig();
const database = createDatabase();
runMigrations(database);
const server = createServer(createApp({ database, config }));
const port = Number(process.env.PORT ?? 3000);

server.listen(port, () => {
  console.info(JSON.stringify({ event: 'server_listening', port }));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      database.close();
      process.exit(0);
    });
  });
}
