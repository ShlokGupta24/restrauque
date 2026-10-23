import fs from 'fs';
import path from 'path';
import { afterAll } from 'vitest';

// Load .env file for vitest test runs
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Automated teardown: ensure any active Prisma connection is cleanly disconnected after each test file
afterAll(async () => {
  try {
    const globalPrisma = (globalThis as { prisma?: { $disconnect: () => Promise<void> } }).prisma;
    if (globalPrisma && typeof globalPrisma.$disconnect === 'function') {
      await globalPrisma.$disconnect();
    }
  } catch {
    // Ignore teardown disconnect errors if already closed or uninitialized
  }
});
