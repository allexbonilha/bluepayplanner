export class BodyTooLarge extends Error{constructor(){super('Request body too large');}}
export async function readLimitedBody(request:Request,limit:number){
 if(Number(request.headers.get('content-length'))>limit)throw new BodyTooLarge();
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new BodyTooLarge();}chunks.push(value);}}finally{reader.releaseLock();}
 const combined=new Uint8Array(size);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(combined);
}
