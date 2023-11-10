import { Prisma } from '@prisma/client';

export default function generateTrendingSqlFragment(
  battleTable: Prisma.Sql,
  battleTableColumn: Prisma.Sql,
) {
  return Prisma.sql`
    -- ref: https://www.notion.so/breadco/Barz-Battle-Sorting-Algorithms-2becd919444a433090a0898b4b0a8443?pvs=4#893cadec5ca04ddd82654b3886c07dfb
    SELECT COALESCE(SUM(
      battle_participant_vote.amount /
      EXTRACT(EPOCH FROM (NOW() - battle_participant_vote.ended_casting_at))
    ), 0)
    FROM battle_participant_vote
    LEFT JOIN battle_participant
      ON battle_participant.id = battle_participant_vote.battle_participant_id
    WHERE battle_participant.battle_id = ${battleTable}.${battleTableColumn}
  `;
}
