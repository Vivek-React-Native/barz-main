import { getWorker as getBattleParticipantMatchingWorker } from './worker/battle-participant-matching-worker.ts';
import { getWorker as getBattleParticipantVideoGenerationWorker } from './worker/battle-participant-video-generation-worker.ts';
import { getWorker as getBattleVideoExportGenerationWorker } from './worker/battle-video-export-generation-worker.ts';
import { getWorker as getConnectionStatusChangeWorker } from './worker/connection-status-change-worker.ts';
import { getWorker as getBattleAutoForfeitWorker } from './worker/battle-auto-forfeit-worker.ts';

getBattleParticipantMatchingWorker();
getBattleParticipantVideoGenerationWorker();
getBattleVideoExportGenerationWorker();
getConnectionStatusChangeWorker();
getBattleAutoForfeitWorker();
console.log('Started worker(s)!');
