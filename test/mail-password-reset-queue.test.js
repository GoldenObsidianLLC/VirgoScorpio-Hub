'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {processPasswordResetRequestBatch}=require('../apps/worker/src/mail-worker');

function createPool({staleRows=[],claimedRows=[]}={}){
 const clientCalls=[];const poolCalls=[];let released=false;
 const client={async query(sql,params=[]){
  const text=String(sql).replace(/\\s+/g,' ').trim();clientCalls.push({sql:text,params});
  if(text.startsWith('SELECT id,attempts FROM password_reset_requests'))return {rows:staleRows};
  if(text.startsWith('WITH picked AS'))return {rows:claimedRows};
  return {rows:[]};
 },release(){released=true;}};
 return {clientCalls,poolCalls,get released(){return released;},async connect(){return client;},async query(sql,params=[]){poolCalls.push({sql:String(sql).replace(/\\s+/g,' ').trim(),params});return {rows:[],rowCount:1};}};
}
function logger(){const entries=[];return {entries,emit(level,event,fields){entries.push({level,event,fields});}};}

test('reset worker claims durable rows with SKIP LOCKED and atomically delegates token/outbox completion',async()=>{
 const id='7e8a462c-608a-4cb6-b5a5-80d9a2b0e001';const pool=createPool({claimedRows:[{id,attempts:1}]});
 const log=logger();const processed=[];const identity={async processPasswordResetRequest(input){processed.push(input);return {processed:true};}};
 const result=await processPasswordResetRequestBatch(pool,{identity,structuredLogger:log});
 assert.equal(result.processed,1);assert.deepEqual(processed,[{id}]);assert.equal(pool.clientCalls[0].sql,'BEGIN');
 const claim=pool.clientCalls.find(call=>call.sql.startsWith('WITH picked AS'));assert.ok(claim.sql.includes('FOR UPDATE SKIP LOCKED'));assert.equal(pool.clientCalls.at(-1).sql,'COMMIT');
 assert.equal(pool.released,true);assert.deepEqual(log.entries,[]);
});

test('reset worker recovers abandoned claims and terminalizes requests after eight attempts',async()=>{
 const retryId='7e8a462c-608a-4cb6-b5a5-80d9a2b0e002';const exhaustedId='7e8a462c-608a-4cb6-b5a5-80d9a2b0e003';
 const pool=createPool({staleRows:[{id:retryId,attempts:2},{id:exhaustedId,attempts:8}]});const log=logger();
 const result=await processPasswordResetRequestBatch(pool,{identity:{async processPasswordResetRequest(){throw new Error('must not run before recovery delay');}},structuredLogger:log});
 assert.equal(result.recovered,2);assert.equal(result.processed,0);
 const updates=pool.clientCalls.filter(call=>call.sql.startsWith('UPDATE password_reset_requests SET status=$2'));
 assert.equal(updates.length,2);assert.deepEqual(updates[0].params,[retryId,'pending',4000,'ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_WORKER_INTERRUPTED']);
 assert.equal(updates[1].params[1],'failed');assert.equal(updates[1].params[0],exhaustedId);
 assert.ok(pool.clientCalls.some(call=>call.sql.includes('target_email=NULL')));
 assert.ok(log.entries.some(entry=>entry.event==='virgoscorpio_hub.password_reset_queue.claims_recovered'));
});

test('reset worker applies bounded exponential retry and logs only sanitized metadata',async()=>{
 const id='7e8a462c-608a-4cb6-b5a5-80d9a2b0e004';const pool=createPool({claimedRows:[{id,attempts:3}]});const log=logger();
 const result=await processPasswordResetRequestBatch(pool,{identity:{async processPasswordResetRequest(){const error=new Error('email=private@example.test');error.code='ERR_PROVIDER_TEMPORARY';throw error;}},structuredLogger:log});
 assert.equal(result.processed,1);assert.equal(result.results[0].status,'retry');
 const update=pool.poolCalls[0];assert.equal(update.params[0],id);assert.equal(update.params[1],'pending');assert.equal(update.params[2],8000);assert.equal(update.params[3],'ERR_PROVIDER_TEMPORARY');
 assert.equal(JSON.stringify(log.entries).includes('private@example.test'),false);
});

test('reset worker terminalizes an exhausted failed attempt and scrubs stale target PII',async()=>{
 const id='7e8a462c-608a-4cb6-b5a5-80d9a2b0e005';const pool=createPool({claimedRows:[{id,attempts:8}]});
 await processPasswordResetRequestBatch(pool,{identity:{async processPasswordResetRequest(){const error=new Error('provider failure');error.code='ERR_PROVIDER_FAILURE';throw error;}},structuredLogger:logger()});
 const update=pool.poolCalls[0];assert.equal(update.params[1],'failed');assert.equal(update.params[3],'ERR_PROVIDER_FAILURE');
 assert.ok(update.sql.includes("target_email=CASE WHEN $2='failed' AND created_at <= now() - interval '120 seconds' THEN NULL"));
});

test('reset worker rejects an unbounded or zero batch size before acquiring a connection',async()=>{
 const pool=createPool();await assert.rejects(processPasswordResetRequestBatch(pool,{identity:{processPasswordResetRequest(){}},limit:0}),/batch limit/);assert.equal(pool.released,false);
});
