import { execSync } from 'node:child_process';
import { join } from 'node:path';

// Get the path to the bin directory using pnpm
const binPath = execSync('pnpm bin', { encoding: 'utf-8' }).trim();
const prismaBin = join(binPath, 'prisma');

execSync(
  `${prismaBin} migrate diff --from-url ${process.env.DATABASE_URL} --to-schema-datamodel prisma/schema.prisma --script | ${prismaBin} db execute --stdin`,
  { stdio: 'inherit' },
);
