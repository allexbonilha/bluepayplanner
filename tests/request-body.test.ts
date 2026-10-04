import test from 'node:test';import assert from 'node:assert/strict';
import {readLimitedBody} from '../lib/request-body.ts';
test('oversized chunked login requests are stopped before buffering the whole body',async()=>{
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(5000));},cancel(){cancelled=true;}});
 await assert.rejects(()=>readLimitedBody(new Request('http://localhost',{method:'POST',body,duplex:'half'} as RequestInit),4096),/large/);assert.equal(cancelled,true);
});
test('bounded reader preserves utf8 and rejects advertised oversized payloads',async()=>{
 assert.equal(await readLimitedBody(new Request('http://localhost',{method:'POST',body:'Olá'}),4096),'Olá');
 await assert.rejects(()=>readLimitedBody(new Request('http://localhost',{method:'POST',headers:{'Content-Length':'5000'},body:'a'}),4096),/large/);
});
