'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const { createPasswordResetQueueMonitor }=require('../packages/observability/src/queue-metrics');
const { createStructuredLogger }=require('../packages/observability/src/structured-logger');

test('password-reset queue monitor emits bounded depth and age snapshots at its interval',async()=>{
 let now=30_000;const queries=[];const records=[];
 const pool={async query(sql){queries.push(sql);return {rows:[{pending:'4',processing:'2',failed_last_24h:'1',oldest_pending_age_seconds:'95'}]};}};
 const logger=createStructuredLogger({logger:{info(line){records.push(JSON.parse(line));},warn(line){records.push(JSON.parse(line));}},service:'virgoscorpio_hub-mail-worker',environment:'test',now:()=>now});
 const monitor=createPasswordResetQueueMonitor({intervalMs:30_000,clock:()=>now});
 const first=await monitor.sample({pool,logger,env:{VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_MAX_PENDING:'800'}});
 assert.deepEqual({pending:first.pending,processing:first.processing,failedLast24h:first.failedLast24h,oldestPendingAgeSeconds:first.oldestPendingAgeSeconds,queueCapacity:first.queueCapacity},{pending:4,processing:2,failedLast24h:1,oldestPendingAgeSeconds:95,queueCapacity:800});
 assert.equal(records[0].event,'virgoscorpio_hub.password_reset_queue.snapshot');
 assert.equal(records[0].pending,4);assert.equal(records[0].processing,2);assert.equal(records[0].failedLast24h,1);assert.equal(records[0].oldestPendingAgeSeconds,95);assert.equal(records[0].queueCapacity,800);
 now+=29_999;assert.equal(await monitor.sample({pool,logger}),null);assert.equal(queries.length,1);
 now+=1;await monitor.sample({pool,logger});assert.equal(queries.length,2);
 assert.equal(JSON.stringify(records).includes('@example'),false);
});

test('password-reset queue monitor fails open and emits only a sanitized operational code',async()=>{
 const records=[];const pool={async query(){throw Object.assign(new Error('database connection string leaked'),{code:'ERR_DATABASE_UNAVAILABLE'});}};
 const logger={emit(level,event,fields){records.push({level,event,fields});}};
 const monitor=createPasswordResetQueueMonitor({clock:()=>1_000});
 assert.equal(await monitor.sample({pool,logger}),null);assert.equal(records.length,1);
 assert.equal(records[0].level,'warn');assert.equal(records[0].event,'virgoscorpio_hub.password_reset_queue.snapshot_failed');
 assert.equal(records[0].fields.code,'ERR_DATABASE_UNAVAILABLE');
 assert.equal(JSON.stringify(records).includes('connection string'),false);
});
