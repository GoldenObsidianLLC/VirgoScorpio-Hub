'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
let sendEmailStub=async()=>{};
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='../../../packages/notifications/src/mailer' && parent?.filename.endsWith(require('node:path').join('apps','worker','src','mail-worker.js'))) return {sendEmail:(...args)=>sendEmailStub(...args)};
 return originalLoad.call(this,request,parent,isMain);
};
let processBatch;
try{({processBatch}=require('../apps/worker/src/mail-worker'));}finally{Module._load=originalLoad;}

function createPool(row){
 const clientCalls=[];const poolCalls=[];
 return {clientCalls,poolCalls,async connect(){return {
  async query(sql,params=[]){clientCalls.push({sql:String(sql),params});
   if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
   if(String(sql).includes('SELECT id,attempts FROM mail_outbox'))return {rows:[]};
   if(String(sql).includes('SELECT id,recipient,template,payload,attempts'))return {rows:[row]};
   return {rows:[]};
  },release(){}};},
 async query(sql,params=[]){poolCalls.push({sql:String(sql),params});return {rows:[],rowCount:1};}};
}
function structuredLogger(records){return {emit(level,event,fields){records.push({level,event,fields});}};}

test('expired password-reset messages are terminalized without sending their expired link',async()=>{
 const now=1_800_000_000_000;const row={id:'3f5b1d6a-36ca-4e82-9ce9-3b6bd53d1e08',recipient:'private@example.test',template:'password-reset',payload:{resetUrl:'https://example.test/reset-password?token=private-token',expiresAt:new Date(now-1000).toISOString()},attempts:1};
 const pool=createPool(row);const records=[];let sends=0;sendEmailStub=async()=>{sends++;};
 const result=await processBatch(pool,{clock:()=>now,structuredLogger:structuredLogger(records),env:{NODE_ENV:'test'}});
 assert.deepEqual(result.results,[{id:row.id,status:'expired'}]);assert.equal(sends,0);
 const update=pool.poolCalls.find(x=>x.params[1]==='ERR_VIRGOSCORPIO_HUB_MAIL_RESET_TOKEN_EXPIRED');
 assert.ok(update);assert.ok(update.sql.includes("payload='{}'::jsonb"));assert.deepEqual(update.params,[row.id,'ERR_VIRGOSCORPIO_HUB_MAIL_RESET_TOKEN_EXPIRED']);
 assert.equal(records[0].event,'virgoscorpio_hub.mail.reset_token_expired');
 assert.equal(JSON.stringify(records).includes('private@example.test'),false);assert.equal(JSON.stringify(records).includes('private-token'),false);
});

test('terminal mail-provider failures scrub the reset URL payload',async()=>{
 const now=1_800_000_000_000;const row={id:'8a9f4a47-6039-4638-b8ea-3a3d48cfab0e',recipient:'private@example.test',template:'password-reset',payload:{resetUrl:'https://example.test/reset-password?token=private-token',expiresAt:new Date(now+60_000).toISOString()},attempts:7};
 const pool=createPool(row);const records=[];sendEmailStub=async()=>{throw Object.assign(new Error('provider detail containing PII'),{code:'ERR_VIRGOSCORPIO_HUB_MAIL_PROVIDER'});};
 const result=await processBatch(pool,{clock:()=>now,structuredLogger:structuredLogger(records),env:{NODE_ENV:'test'}});
 assert.deepEqual(result.results,[{id:row.id,status:'failed'}]);
 const update=pool.poolCalls.find(x=>x.sql.includes('UPDATE mail_outbox SET status=$2'));
 assert.ok(update.sql.includes("payload=CASE WHEN $2='failed' THEN '{}'::jsonb ELSE payload END"));
 assert.equal(update.params[1],'failed');assert.equal(update.params[2],8);
 assert.equal(JSON.stringify(records).includes('private@example.test'),false);assert.equal(JSON.stringify(records).includes('private-token'),false);
});

test('transient mail failures retain payload only while retrying',async()=>{
 const now=1_800_000_000_000;const row={id:'c2e1e8bf-9eb8-489f-926c-9e1b8ed5aeba',recipient:'private@example.test',template:'password-reset',payload:{resetUrl:'https://example.test/reset-password?token=private-token',expiresAt:new Date(now+60_000).toISOString()},attempts:1};
 const pool=createPool(row);sendEmailStub=async()=>{throw Object.assign(new Error('transient provider error'),{code:'ERR_VIRGOSCORPIO_HUB_MAIL_TRANSIENT'});};
 const result=await processBatch(pool,{clock:()=>now,structuredLogger:structuredLogger([]),env:{NODE_ENV:'test'}});
 const update=pool.poolCalls.find(x=>x.sql.includes('UPDATE mail_outbox SET status=$2'));
 assert.equal(result.results[0].status,'retry');assert.equal(update.params[1],'pending');
 assert.ok(update.sql.includes("payload=CASE WHEN $2='failed' THEN '{}'::jsonb ELSE payload END"));
});
