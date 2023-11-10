import { Redis } from 'ioredis';
import { REDIS_CONFIG } from '../config.ts';

export const redisConnection = new Redis(REDIS_CONFIG);

// NOTE: I was seeing this in the logs, after I started sharing the redis connection across all
// bullmq workers:
//
// (node:27671) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 error listeners added to [Commander]. Use emitter.setMaxListeners() to increase limit
// (node:27671) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 ready listeners added to [Commander]. Use emitter.setMaxListeners() to increase limit
// (node:27671) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 close listeners added to [Commander]. Use emitter.setMaxListeners() to increase limit
//
// It seems like this is probably expected given that now many workers are all subscribing to the
// same redis instances, so this ine below silences this warning:
redisConnection.setMaxListeners(100);
