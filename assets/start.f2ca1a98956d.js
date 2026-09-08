(()=>{
 'use strict';
 const assets={"aerial":{"parts":["assets/aerial-8k.39ba2c3d035b.jpg.part01.bin","assets/aerial-8k.39ba2c3d035b.jpg.part02.bin","assets/aerial-8k.39ba2c3d035b.jpg.part03.bin","assets/aerial-8k.39ba2c3d035b.jpg.part04.bin","assets/aerial-8k.39ba2c3d035b.jpg.part05.bin","assets/aerial-8k.39ba2c3d035b.jpg.part06.bin"],"bytes":49228024,"sha256":"39ba2c3d035bb52209f972933ec4f08a28de10b899012e814cdca0b820caab46"},"clean":"assets/ground-clean.f7ea8575dc75.png","summer":"assets/summer-color.d3e3f3f31aee.png","scene":{"parts":["assets/scene.422b4cb00a10.json.part01.bin","assets/scene.422b4cb00a10.json.part02.bin","assets/scene.422b4cb00a10.json.part03.bin","assets/scene.422b4cb00a10.json.part04.bin"],"bytes":31746278,"sha256":"422b4cb00a109a9785138499dad664d5dc6ee3da0509f2081cfaf3fe055d9c95"},"sceneGzip":"assets/scene.422b4cb00a10.json.gz","viewer":"assets/viewer.0b8687b57a05.js"}, message=document.getElementById('loadstatus');
 const text=value=>{message.textContent=value;};
 window.CLEAN_AERIAL_DATA='./'+assets.clean;
 window.GREEN_AERIAL_DATA='./'+assets.summer;
 let active=0;const queue=[];
 async function limited(task){if(active>=3)await new Promise(resolve=>queue.push(resolve));active++;try{return await task();}finally{active--;queue.shift()?.();}}
 async function fetchBytes(path,label){
  const response=await fetch('./'+path);
  if(!response.ok)throw new Error('文件加载失败（'+response.status+'）');
  if(!response.body)return new Uint8Array(await response.arrayBuffer());
  const reader=response.body.getReader(),parts=[];let received=0,total=Number(response.headers.get('content-length'));
  for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);received+=value.length;if(label)text(label+' '+(received/1048576).toFixed(1)+' MB'+(total?' / '+(total/1048576).toFixed(1)+' MB':'')+'…');}
  return join(parts,received);
 }
 function join(parts,total=parts.reduce((n,p)=>n+p.length,0)){
  const data=new Uint8Array(total);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}return data;
 }
 async function verify(data,spec){
  if(data.length!==spec.bytes)throw new Error('下载内容不完整');
  if(window.crypto?.subtle){const digest=Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==spec.sha256)throw new Error('下载内容校验失败');}
  return data;
 }
 async function fetchParts(spec,label){
  let completed=0;const parts=await Promise.all(spec.parts.map(path=>limited(async()=>{
   const bytes=await fetchBytes(path);completed++;text(label+'（'+completed+'/'+spec.parts.length+'）…');return bytes;
  })));
  return verify(join(parts),spec);
 }
 async function loadAerial(){
  const bytes=await fetchParts(assets.aerial,'正在载入 8K 航拍底图');
  window.AERIAL_DATA=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
 }
 async function loadScene(){
  if('DecompressionStream' in window){
   try{const compressed=await fetchBytes(assets.sceneGzip,'正在载入三维模型');text('正在展开三维场景…');
    const content=compressed[0]===31&&compressed[1]===139?await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(compressed);
    return JSON.parse(content);
   }catch(error){text('正在切换兼容加载方式…');}
  }
  return JSON.parse(new TextDecoder().decode(await fetchParts(assets.scene,'正在载入兼容场景')));
 }
 function failed(error){text('加载暂未完成，请检查网络后重试。');const button=document.createElement('button');button.textContent='重新加载';button.style.cssText='border:0;border-radius:6px;padding:10px 24px;background:#174f40;color:white';button.onclick=()=>location.reload();document.getElementById('loading').appendChild(button);}
 Promise.all([loadScene(),loadAerial()]).then(([data])=>{
  if(!data.instances||!data.geometries)throw new Error('场景数据不完整');
  window.SCENE_DATA=data;text('正在构建场景并载入高清材质…');
  const script=document.createElement('script');script.src='./'+assets.viewer;script.onerror=failed;document.body.appendChild(script);
 }).catch(failed);
})();
