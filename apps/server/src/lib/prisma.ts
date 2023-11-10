import { PrismaClient } from '@prisma/client';
import { addCleanupListener } from 'async-cleanup';

const prisma = new PrismaClient();

// This type represents `tx` in `prisma.$transaction(async (tx) => { ... })`
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

addCleanupListener(async () => {
  console.log(`-> Disconnecting from prisma...`);
  await prisma.$disconnect();
});

export default prisma;
