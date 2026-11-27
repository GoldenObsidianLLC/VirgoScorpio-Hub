'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthRouteHandlers } = require('../apps/api/src/auth-routes');
const { createIdentityService } = require('../packages/auth/src/service');

function response() { return { statusCode: null, headers: {}, body: null, setHeader(k,v){this.headers[k.toLowerCase()]=v;} }; }
function sendJson(res,status,payload){res.statusCode=status;res.body=JSON.stringify(payload);return true;}
function makeHandlers(identity,env={NODE_ENV:'production'}){
  return createAuthRouteHandlers({
    identity, env, secureCookies:false, maxBody:16384,
    allowRequest:()=>({allowed:true,remaining:10}),
    sendJson, readJson:async()=>({email:'  Person@Example.com  '}), readForm:async()=>({}),
    fail:(statusCode,code,message)=>Object.assign(new Error(message),{statusCode,code}),
    sameSecret:(a,b)=>a===b
  });
}
function makeRequest(){return {method:'POST',socket:{remoteAddress:'203.0.113.9'},headers:{},async *[Symbol.asyncIterator](){yield Buffer.from('{}');}};}

function fakeQueuePool({recent=false,pending=0}={}){
  const calls=[];let connections=0;
  return {calls,get connections(){return connections;},async query(){return {rows:[]};},async connect(){connections++;return {
    async query(sql,params=[]){
      calls.push({sql:String(sql).replace(/\\s+/g,' ').trim(),params});
      if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
      if(String(sql).includes('FROM password_reset_requests WHERE target_email'))return {rows:recent?[{one:1}]:[]};
      if(String(sql).includes('count(*)::integer AS pending'))return {rows:[{pending}]};
      if(String(sql).includes('INSERT INTO password_reset_requests'))return {rows:[],rowCount:1};
      return {rows:[]};
    },release(){}
  };}};
}

test('production reset route waits for durable enqueue before sending generic 202',async()=>{
  let resolveCommit;let announceStarted;const commitGate=new Promise(resolve=>{resolveCommit=resolve;});const started=new Promise(resolve=>{announceStarted=resolve;});
  const order=[];
  const identity={
    async enqueuePasswordResetRequest({email}){order.push('enqueue-start');assert.equal(email,'  Person@Example.com  ');announceStarted();await commitGate;order.push('enqueue-committed');return {accepted:true};},
    async requestPasswordReset(){throw new Error('non-queued request path must not run in production');}
  };
  const handlers=makeHandlers(identity);const res=response();
  const pending=handlers.handlePublic({req:makeRequest(),res,url:new URL('http://localhost/api/v1/auth/password-reset/request'),requestId:'request-123456'});
  await started;assert.equal(res.statusCode,null,'the route must not acknowledge before the enqueue transaction completes');
  assert.deepEqual(order,['enqueue-start']);resolveCommit();await pending;
  assert.deepEqual(order,['enqueue-start','enqueue-committed']);assert.equal(res.statusCode,202);
  const body=JSON.parse(res.body);assert.equal(body.accepted,true);assert.match(body.message,/If an active account matches/);
  assert.equal(Object.hasOwn(body,'email'),false);assert.equal(Object.hasOwn(body,'targetEmail'),false);
});

test('production reset route fails closed when durable enqueue is unavailable',async()=>{
  const handlers=makeHandlers({async requestPasswordReset(){throw new Error('legacy method must not be used');}});
  await assert.rejects(handlers.handlePublic({req:makeRequest(),res:response(),url:new URL('http://localhost/api/v1/auth/password-reset/request'),requestId:'request-123456'}),error=>error.statusCode===503&&error.code==='ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_UNAVAILABLE');
});

test('explicit non-production developer-token opt-in retains direct token behavior',async()=>{
  const handlers=makeHandlers({async requestPasswordReset(){return {accepted:true,developmentToken:'dev-only-token'};}},{NODE_ENV:'test',VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS:'true'});
  const res=response();await handlers.handlePublic({req:makeRequest(),res,url:new URL('http://localhost/api/v1/auth/password-reset/request'),requestId:'request-123456'});
  assert.equal(res.statusCode,202);assert.equal(JSON.parse(res.body).developmentToken,'dev-only-token');
});

test('queue enqueue normalizes email and commits a durable row under the shared capacity lock',async()=>{
  const pool=fakeQueuePool();const identity=createIdentityService({pool,env:{NODE_ENV:'production'}});
  assert.deepEqual(await identity.enqueuePasswordResetRequest({email:'  Person@Example.com  '}),{accepted:true});
  assert.equal(pool.calls[0].sql,'BEGIN');
  assert.ok(pool.calls.some(call=>call.sql.includes('pg_advisory_xact_lock')));
  const insert=pool.calls.find(call=>call.sql.includes('INSERT INTO password_reset_requests'));assert.deepEqual(insert.params,['person@example.com']);
  assert.equal(pool.calls.at(-1).sql,'COMMIT');
});

test('queue enqueue coalesces a recent target without adding another row',async()=>{
  const pool=fakeQueuePool({recent:true});const identity=createIdentityService({pool,env:{NODE_ENV:'production'}});
  assert.deepEqual(await identity.enqueuePasswordResetRequest({email:'person@example.com'}),{accepted:true});
  const cooldown = pool.calls.find(call => call.sql.includes('FROM password_reset_requests WHERE target_email'));
  assert.ok(cooldown.sql.includes("status IN ('pending','processing','completed','failed')"));
  assert.equal(pool.calls.some(call=>call.sql.includes('INSERT INTO password_reset_requests')),false);
  assert.equal(pool.calls.at(-1).sql,'COMMIT');
});

test('queue enqueue fails closed at its configured pending capacity',async()=>{
  const pool=fakeQueuePool({pending:2});const identity=createIdentityService({pool,env:{NODE_ENV:'production',VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_MAX_PENDING:'2'}});
  await assert.rejects(identity.enqueuePasswordResetRequest({email:'person@example.com'}),error=>error.statusCode===503&&error.code==='ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_FULL');
  assert.equal(pool.calls.some(call=>call.sql.includes('INSERT INTO password_reset_requests')),false);assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
});

test('invalid email is acknowledged without consuming queue capacity',async()=>{
  const pool=fakeQueuePool();const identity=createIdentityService({pool,env:{NODE_ENV:'production'}});
  assert.deepEqual(await identity.enqueuePasswordResetRequest({email:'not-an-email'}),{accepted:true});assert.equal(pool.connections,0);
});

test('invalid queue capacity configuration is rejected before a database transaction',async()=>{
  const pool=fakeQueuePool();const identity=createIdentityService({pool,env:{NODE_ENV:'production',VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_MAX_PENDING:'0'}});
  await assert.rejects(identity.enqueuePasswordResetRequest({email:'person@example.com'}),error=>error.code==='ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_CONFIG');assert.equal(pool.connections,0);
});
