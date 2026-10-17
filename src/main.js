import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';

const q = (s, root = document) => root.querySelector(s);
const qa = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHtml = value => String(value??'').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const palettes = [
  ['#b7c7c2','#17211f','#e9dfc8'], ['#c86e58','#281a18','#edc9a7'],
  ['#7090bb','#151d2b','#d5d7ca'], ['#d2ad4c','#302115','#eadab8'],
  ['#9a769d','#231925','#dfc0ca'], ['#6d9b7b','#14231a','#d7d2a5'],
  ['#d48a9c','#2d1820','#f0d0bc'], ['#8292a0','#171b1e','#d8c3a6'],
];
const typePresets={
  airy:{font:"'Noto Serif SC','Songti SC',serif",weight:600,spacing:'-.045em',style:'normal'},
  nocturne:{font:"'ZCOOL XiaoWei','Noto Serif SC','Songti SC',serif",weight:400,spacing:'-.015em',style:'normal'},
  poster:{font:"'Archivo Black','Noto Sans SC','Microsoft YaHei',sans-serif",weight:900,spacing:'-.085em',style:'normal'},
  brush:{font:"'Ma Shan Zheng','STKaiti','KaiTi',cursive",weight:400,spacing:'.015em',style:'normal'},
  archive:{font:"'Noto Serif SC','Songti SC',serif",weight:900,spacing:'-.06em',style:'normal'},
};

function directCoverUrl(value=''){
  let source=String(value||'').trim();if(!source)return '';
  try{
    const parsed=new URL(source,location.origin);
    if(parsed.pathname==='/api/netease/image')source=parsed.searchParams.get('url')||'';
    if(!source)return '';
    const cover=new URL(source.replace(/^http:/,'https:'));
    if(!cover.hostname.endsWith('.music.126.net')&&!cover.hostname.endsWith('.music.163.com'))return source;
    cover.searchParams.set('param','800y800');return cover.href;
  }catch{return source}
}

function coverDisplayUrl(value=''){
  const source=directCoverUrl(value);if(!source)return '';
  try{
    const parsed=new URL(source,location.origin);
    const isNetease=parsed.hostname.endsWith('.music.126.net')||parsed.hostname.endsWith('.music.163.com');
    return isNetease?`/api/netease/image?url=${encodeURIComponent(parsed.href)}`:source;
  }catch{return source}
}

function coverCanvas(title='等待你的唱片', artist='IMPORT AN ALBUM', palette=palettes[0]) {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=1024;
  const c=canvas.getContext('2d'); c.fillStyle=palette[0]; c.fillRect(0,0,1024,1024);
  c.strokeStyle=palette[2]; c.lineWidth=70;
  for(let i=0;i<7;i++){c.beginPath();c.arc(720,340,80+i*72,0,Math.PI*1.72);c.stroke()}
  c.fillStyle=palette[1]; c.font='900 92px Arial';
  const short=title.slice(0,12); c.fillText(short,62,785);
  c.font='28px Arial';c.fillText(artist.slice(0,28).toUpperCase(),68,842);
  c.font='22px monospace';c.fillText('47 DEGREE / PRIVATE PRESSING',68,934);
  return canvas;
}

function coverMainColor(artwork,fallback='#252522'){
  const sample=document.createElement('canvas');sample.width=sample.height=32;const c=sample.getContext('2d',{willReadFrequently:true});
  try{
    c.drawImage(artwork,0,0,32,32);const pixels=c.getImageData(0,0,32,32).data,bins=new Map();
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i+3]<180)continue;
      const r=Math.round(pixels[i]/24)*24,g=Math.round(pixels[i+1]/24)*24,b=Math.round(pixels[i+2]/24)*24;
      const key=`${Math.min(r,255)},${Math.min(g,255)},${Math.min(b,255)}`;bins.set(key,(bins.get(key)||0)+1);
    }
    const winner=[...bins].sort((a,b)=>b[1]-a[1])[0]?.[0];
    return winner?`rgb(${winner})`:fallback;
  }catch{return fallback}
}

function inkFor(color){
  const probe=document.createElement('canvas').getContext('2d');probe.fillStyle=color;const normalized=probe.fillStyle;
  probe.fillStyle='#000';probe.fillStyle=normalized;const match=probe.fillStyle.match(/[\da-f]{2}/gi);
  let rgb=match?.map(value=>parseInt(value,16));
  if(!rgb||rgb.length<3){const nums=normalized.match(/\d+/g);rgb=nums?.slice(0,3).map(Number)}
  const [r=32,g=32,b=32]=rgb||[];return .2126*r+.7152*g+.0722*b>145?'#171713':'#f4efe5';
}

function drawBarcode(c,x,y,width,height,seed,ink){
  c.save();c.fillStyle=ink;c.globalAlpha=.94;const digits=String(seed||'33').replace(/\D/g,'')||'33';let cursor=x;
  for(let i=0;cursor<x+width-2;i++){
    const digit=Number(digits[i%digits.length]),bar=1+(digit+i*3)%4,gap=1+(digit+i)%3;
    c.fillRect(cursor,y,bar,height-(i%4===0?0:10));cursor+=bar+gap;
  }
  c.restore();
}

function seededRandom(seed){
  let value=[...String(seed)].reduce((sum,char)=>Math.imul(sum^char.charCodeAt(0),2654435761)>>>0,2166136261);
  return()=>{value+=0x6D2B79F5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
}

function vinylCanvas(album,artwork){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d'),random=seededRandom(album.id);
  const sampled=album.palette[0]||coverMainColor(artwork,'#506b78'),color=new THREE.Color(sampled),hsl={h:0,s:0,l:0};color.getHSL(hsl);
  hsl.l=Math.min(.7,Math.max(.14,hsl.l));color.setHSL(hsl.h,hsl.s,hsl.l);const base=`#${color.getHexString()}`;
  c.fillStyle=base;c.fillRect(0,0,1024,1024);
  const glow=c.createRadialGradient(385,315,30,512,512,720);glow.addColorStop(0,'rgba(255,255,255,.28)');glow.addColorStop(.36,'rgba(255,255,255,.04)');glow.addColorStop(.72,'rgba(0,0,0,.08)');glow.addColorStop(1,'rgba(0,0,0,.42)');c.fillStyle=glow;c.fillRect(0,0,1024,1024);
  const variant=[...String(album.id)].reduce((sum,char)=>sum+char.charCodeAt(0),0)%3;
  c.save();c.translate(512,512);
  if(variant===0){
    for(let i=0;i<28;i++){const angle=i/28*Math.PI*2+(random()-.5)*.12,length=300+random()*210;c.beginPath();c.moveTo(Math.cos(angle)*165,Math.sin(angle)*165);c.lineTo(Math.cos(angle)*length,Math.sin(angle)*length);c.strokeStyle=i%3?'rgba(255,255,255,.16)':'rgba(0,0,0,.12)';c.lineWidth=10+random()*30;c.stroke()}
  }else if(variant===1){
    for(let i=0;i<22;i++){c.beginPath();const start=random()*Math.PI*2,radius=185+random()*300;c.arc((random()-.5)*90,(random()-.5)*90,radius,start,start+.45+random()*1.8);c.strokeStyle=i%2?'rgba(255,255,255,.17)':'rgba(0,0,0,.1)';c.lineWidth=12+random()*34;c.stroke()}
  }else{
    const halo=c.createRadialGradient(0,0,155,0,0,510);halo.addColorStop(0,'rgba(0,0,0,.2)');halo.addColorStop(.42,'rgba(255,255,255,.03)');halo.addColorStop(.72,'rgba(255,255,255,.3)');halo.addColorStop(1,'rgba(255,255,255,.06)');c.fillStyle=halo;c.fillRect(-512,-512,1024,1024);
  }
  c.restore();
  c.save();c.translate(512,512);c.lineCap='round';
  for(let i=0;i<32;i++){
    c.beginPath();const radius=160+random()*360,start=random()*Math.PI*2,length=.25+random()*1.7;
    c.arc((random()-.5)*100,(random()-.5)*100,radius,start,start+length);c.strokeStyle=random()>.48?'rgba(255,255,255,.055)':'rgba(0,0,0,.07)';c.lineWidth=2+random()*17;c.stroke();
  }
  for(let radius=170;radius<498;radius+=3.35){c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.strokeStyle=radius%10<5?'rgba(255,255,255,.075)':'rgba(0,0,0,.09)';c.lineWidth=.7;c.stroke()}
  for(let i=0;i<420;i++){const angle=random()*Math.PI*2,radius=155+random()*345,size=random()<.92?.45:1.2;c.fillStyle=random()>.5?'rgba(255,255,255,.09)':'rgba(0,0,0,.1)';c.fillRect(Math.cos(angle)*radius,Math.sin(angle)*radius,size,size)}
  c.restore();
  return canvas;
}

function recordLabelCanvas(album){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d'),random=seededRandom(`${album.id}-label`);
  const variant=[...String(album.id)].reduce((sum,char)=>sum+char.charCodeAt(0),0)%3,background=variant===1?album.palette[1]:album.palette[2],ink=inkFor(background);
  c.fillStyle=background;c.fillRect(0,0,512,512);
  c.save();c.translate(256,256);c.strokeStyle=ink;c.globalAlpha=.18;c.lineWidth=2;for(let r=118;r<248;r+=14){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke()}
  c.globalAlpha=.92;c.fillStyle=ink;
  if(variant===0){c.beginPath();c.arc(0,0,220,-.3,1.9);c.lineTo(0,0);c.fill()}
  else if(variant===1){for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3+random()*.2);c.fillRect(82,-14,145,28);c.restore()}}
  else{c.beginPath();c.arc(-72,-44,116,0,Math.PI*2);c.fill();c.globalCompositeOperation='destination-out';c.beginPath();c.arc(-40,-44,96,0,Math.PI*2);c.fill();c.globalCompositeOperation='source-over'}
  c.restore();
  const textColor=variant===0||variant===2?background:ink,plate=variant===0||variant===2?ink:background;
  c.fillStyle=plate;c.globalAlpha=.94;c.beginPath();c.arc(256,256,132,0,Math.PI*2);c.fill();c.globalAlpha=1;c.fillStyle=textColor;c.textAlign='center';
  c.font='700 17px "Noto Sans SC",Arial,sans-serif';c.fillText('47 DEGREE · SIDE A',256,176);
  let size=42;c.font=`900 ${size}px "Noto Serif SC","Songti SC",serif`;while(c.measureText(album.name).width>220&&size>22){size-=2;c.font=`900 ${size}px "Noto Serif SC","Songti SC",serif`}c.fillText(album.name.slice(0,18),256,236);
  c.font='18px "Noto Sans SC",Arial,sans-serif';c.globalAlpha=.78;c.fillText(album.artist.slice(0,24),256,274);c.globalAlpha=1;
  c.font='13px monospace';c.fillText(`CAT. 47-${String(album.id).slice(-6)}  ·  ${album.year||'—'}`,256,326);c.fillText('STEREO  /  33⅓ RPM',256,350);
  c.fillStyle=textColor;c.beginPath();c.arc(256,256,9,0,Math.PI*2);c.fill();
  return canvas;
}

function packageCanvases(album, artwork){
  const sideColor=coverMainColor(artwork,album.palette[0]),ink=inkFor(sideColor),mutedInk=ink==='#171713'?'rgba(23,23,19,.66)':'rgba(244,239,229,.72)';
  const spine=(mirrored=false)=>{
    const canvas=document.createElement('canvas');canvas.width=180;canvas.height=1024;const c=canvas.getContext('2d');
    c.fillStyle=sideColor;c.fillRect(0,0,canvas.width,canvas.height);
    c.fillStyle=ink;c.globalAlpha=.18;c.fillRect(mirrored?168:0,0,12,1024);c.globalAlpha=1;
    c.save();c.translate(mirrored?51:129,54);c.rotate(Math.PI/2);c.fillStyle=ink;c.font='700 35px "Noto Sans SC",Arial,sans-serif';c.fillText(album.name.slice(0,22),0,0,610);c.fillStyle=mutedInk;c.font='20px "Noto Sans SC",Arial,sans-serif';c.fillText(album.artist.slice(0,28),0,39,590);c.restore();
    c.fillStyle=ink;c.font='15px monospace';c.textAlign='center';c.fillText(`47-${String(album.id).slice(-6)}`,90,792);c.fillStyle=mutedInk;c.font='13px monospace';c.fillText(`${album.year||'—'} · STEREO`,90,817);
    c.strokeStyle=ink;c.globalAlpha=.28;c.strokeRect(29.5,842.5,121,135);c.globalAlpha=1;drawBarcode(c,42,858,96,76,album.id,ink);c.fillStyle=ink;c.font='11px monospace';c.fillText(String(album.id).replace(/\D/g,'').slice(-11).padStart(11,'0'),90,955);
    return canvas;
  };
  const edge=(upsideDown=false)=>{
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=180;const c=canvas.getContext('2d');
    c.fillStyle=sideColor;c.fillRect(0,0,1024,180);
    if(upsideDown){c.translate(1024,180);c.rotate(Math.PI)}c.fillStyle=ink;c.font='700 35px Arial';c.fillText(`${album.name}  /  ${album.artist}`,52,78,760);c.fillStyle=mutedInk;c.font='20px monospace';c.fillText(`47 DEGREE · ${album.year||'—'} · CAT. 47-${String(album.id).slice(-6)}`,52,122);drawBarcode(c,858,48,110,74,album.id,ink);return canvas;
  };
  const back=document.createElement('canvas');back.width=back.height=1024;const b=back.getContext('2d');
  b.globalAlpha=.28;b.drawImage(artwork,0,0,1024,1024);b.globalAlpha=1;b.fillStyle=`${album.palette[1]}e8`;b.fillRect(0,0,1024,1024);b.fillStyle=album.palette[2];
  b.font='900 64px Arial';b.fillText(album.name.slice(0,18),64,95,890);b.font='27px Arial';b.globalAlpha=.8;b.fillText(`${album.artist}  /  ${album.year||'—'}`,68,140,850);b.globalAlpha=1;b.fillRect(68,178,888,2);
  b.font='22px Arial';album.tracks.slice(0,20).forEach((track,index)=>{const column=index<10?0:1,row=index%10,x=70+column*440,y=235+row*48;b.globalAlpha=.55;b.font='18px monospace';b.fillText(String(index+1).padStart(2,'0'),x,y);b.globalAlpha=1;b.font='22px Arial';b.fillText(track.name.slice(0,22),x+48,y,340)});
  b.globalAlpha=.75;b.font='16px monospace';b.fillText(`CAT. 47-${String(album.id).slice(-6)}  ·  DIGITAL PRESSING`,68,942);for(let i=0;i<34;i++){b.fillRect(760+i*5,900,(i%3)+1,58)}
  return{right:spine(false),left:spine(true),top:edge(false),bottom:edge(true),back};
}

function canvasMap(canvas){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer?.capabilities?.getMaxAnisotropy?.()||1;return texture}

function refreshPackaging(object,album,artwork){
  const surfaces=packageCanvases(album,artwork);['right','left','top','bottom','back'].forEach(name=>{const material=object.userData.packageMaterials[name];material.map?.dispose();material.map=canvasMap(surfaces[name]);material.needsUpdate=true});
}

function refreshVinyl(object,album,artwork){
  const material=object.userData.discMaterial,next=canvasMap(vinylCanvas(album,artwork));material.map?.dispose();material.map=next;material.needsUpdate=true;
  const grooveColor=new THREE.Color(album.palette[0]||coverMainColor(artwork,'#506b78'));grooveColor.offsetHSL(0,0,grooveColor.getHSL({h:0,s:0,l:0}).l>.5?-.2:.1);object.userData.grooveMaterials.forEach((groove,index)=>groove.color.copy(grooveColor).offsetHSL(0,0,index%2?.028:0));
}

const demo={
  id:'demo', name:'等待你的唱片', artist:'点击右上角导入网易云专辑', year:'2026', palette:palettes[0], cover:'',
  description:'导入网易云专辑后，这里会整理专辑简介和每首曲目的基础资料。',
  tracks:[],
};
let albums=[demo], accountEnabled=false, currentUser;
let selected=0, opened=false, playing=false, trackIndex=0, bookletPage=0, noteSubpage=0, notePages=[];
let albumObjects=[];
let playbackHistory=[];

const canvas=q('.webgl'), wrap=q('.scene-wrap'), audio=q('audio');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(0,.1,12.5);scene.add(camera);
scene.add(new THREE.HemisphereLight(0xffffff,0x25251f,2.8));
const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-5,6,7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=6;key.shadow.camera.bottom=-4;key.shadow.radius=5;key.shadow.blurSamples=16;key.shadow.bias=-.00035;key.shadow.normalBias=.025;scene.add(key);
const rim=new THREE.PointLight(0xffffff,9,20);rim.position.set(5,-2,5);scene.add(rim);
const collection=new THREE.Group();scene.add(collection);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(24,12),new THREE.ShadowMaterial({color:0x10120f,opacity:.23}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.72;floor.position.z=-1;floor.receiveShadow=true;scene.add(floor);

function makeAlbumObject(album,index){
  const group=new THREE.Group(); group.userData={album,index};
  const fallbackArtwork=coverCanvas(album.name,album.artist,album.palette);
  const texture=canvasMap(fallbackArtwork);
  const front=new THREE.MeshStandardMaterial({map:texture,roughness:.46,metalness:.03});
  const packageArtwork=packageCanvases(album,fallbackArtwork);
  const packageMaterials={
    right:new THREE.MeshStandardMaterial({map:canvasMap(packageArtwork.right),roughness:.62}),
    left:new THREE.MeshStandardMaterial({map:canvasMap(packageArtwork.left),roughness:.62}),
    top:new THREE.MeshStandardMaterial({map:canvasMap(packageArtwork.top),roughness:.66}),
    bottom:new THREE.MeshStandardMaterial({map:canvasMap(packageArtwork.bottom),roughness:.7}),
    back:new THREE.MeshStandardMaterial({map:canvasMap(packageArtwork.back),roughness:.58}),
  };
  const sleeve=new THREE.Mesh(new THREE.BoxGeometry(3.15,3.15,.24),[packageMaterials.right,packageMaterials.left,packageMaterials.top,packageMaterials.bottom,front,packageMaterials.back]);sleeve.position.z=.13;sleeve.castShadow=true;sleeve.receiveShadow=true;group.add(sleeve);
  const vinyl=new THREE.Group();vinyl.position.set(.15,0,-.03);group.add(vinyl);
  const discMaterial=new THREE.MeshPhysicalMaterial({map:canvasMap(vinylCanvas(album,fallbackArtwork)),roughness:.31,metalness:.08,clearcoat:.62,clearcoatRoughness:.24,reflectivity:.72});
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.48,1.48,.075,96),discMaterial);disc.rotation.x=Math.PI/2;disc.castShadow=true;vinyl.add(disc);
  const grooveMaterials=[];for(let g=0;g<7;g++){const grooveMaterial=new THREE.MeshBasicMaterial({color:g%2?0x44443f:0x292a27,transparent:true,opacity:.58});grooveMaterials.push(grooveMaterial);const groove=new THREE.Mesh(new THREE.TorusGeometry(.79+g*.083,.004,6,96),grooveMaterial);groove.position.z=.042;vinyl.add(groove)}
  const label=new THREE.Mesh(new THREE.CircleGeometry(.48,64),new THREE.MeshStandardMaterial({map:canvasMap(recordLabelCanvas(album)),roughness:.58,metalness:.02}));label.position.z=.047;vinyl.add(label);
  const spindle=new THREE.Mesh(new THREE.CircleGeometry(.025,24),new THREE.MeshBasicMaterial({color:0x171713}));spindle.position.z=.049;vinyl.add(spindle);
  group.userData.vinyl=vinyl;group.userData.sleeve=sleeve;group.userData.front=front;group.userData.texture=texture;group.userData.packageMaterials=packageMaterials;group.userData.discMaterial=discMaterial;group.userData.grooveMaterials=grooveMaterials;
  refreshVinyl(group,album,fallbackArtwork);
  if(album.cover){new THREE.TextureLoader().load(coverDisplayUrl(album.cover),(remote)=>{remote.colorSpace=THREE.SRGBColorSpace;remote.anisotropy=renderer.capabilities.getMaxAnisotropy();front.map=remote;front.needsUpdate=true;refreshPackaging(group,album,remote.image);refreshVinyl(group,album,remote.image)},undefined,()=>{})}
  return group;
}

function rebuildCollection(){
  albumObjects.forEach(o=>collection.remove(o));
  albumObjects=albums.map((album,index)=>{const object=makeAlbumObject(album,index);collection.add(object);return object});
  layoutCollection(false);updateUI();renderPlaylists();
}

function relativeIndex(index){
  let value=index-selected;const half=albums.length/2;
  if(value>half)value-=albums.length;if(value<-half)value+=albums.length;return value;
}

function layoutCollection(animate=true){
  albumObjects.forEach((object,index)=>{
    const offset=relativeIndex(index), distance=Math.abs(offset), side=Math.sign(offset), active=distance===0;
    // A physical record-bin fan: the selected sleeve faces the listener while
    // neighbouring sleeves quickly turn edge-on and overlap into the distance.
    const x=active?0:side*(2.1+(distance-1)*.88);
    const y=active?0:Math.min(distance*.055,.22);
    const z=active ? .35 : -.1-distance*.55;
    const rotationY=active?0:-side*(.68+Math.min(distance-1,4)*.055);
    const rotationZ=active?-.012:side*(.012+distance*.004);
    const scale=active?1.06:Math.max(.72,.93-distance*.025);
    const vars={x,y,z,rotationY,rotationZ,scale,duration:animate&&!reduceMotion?1.05:0,ease:'power4.inOut',overwrite:'auto'};
    gsap.to(object.position,{x:vars.x,y:vars.y,z:vars.z,duration:vars.duration,ease:vars.ease,overwrite:'auto'});
    gsap.to(object.rotation,{y:vars.rotationY,z:vars.rotationZ,duration:vars.duration,ease:vars.ease,overwrite:'auto'});
    gsap.to(object.scale,{x:vars.scale,y:vars.scale,z:vars.scale,duration:vars.duration,ease:vars.ease,overwrite:'auto'});
    gsap.to(object.userData.vinyl.position,{x:.15,duration:vars.duration,ease:vars.ease,overwrite:'auto'});
    object.renderOrder=100-Math.round(distance);
  });
}

function applyTypography(album){
  const preset=typePresets[album.typography||'archive'];
  const root=document.documentElement;
  root.style.setProperty('--album-title-font',preset.font);
  root.style.setProperty('--album-title-weight',preset.weight);
  root.style.setProperty('--album-title-spacing',preset.spacing);
  root.style.setProperty('--album-title-style',preset.style);
}

function analyzeCoverTypography(album){
  if(!album.cover||album.typographyAnalyzed)return;
  album.typographyAnalyzed=true;
  const image=new Image();image.crossOrigin='anonymous';image.decoding='async';
  image.onload=()=>{
    const sample=document.createElement('canvas');sample.width=sample.height=48;
    const context=sample.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,48,48);
    const pixels=context.getImageData(0,0,48,48).data;let luminance=0,saturation=0,squared=0,count=0;
    for(let index=0;index<pixels.length;index+=16){const r=pixels[index]/255,g=pixels[index+1]/255,b=pixels[index+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),light=.2126*r+.7152*g+.0722*b;luminance+=light;squared+=light*light;saturation+=max?((max-min)/max):0;count++}
    luminance/=count;saturation/=count;const contrast=Math.sqrt(Math.max(0,squared/count-luminance*luminance));
    if(luminance>.7&&saturation<.34)album.typography='airy';
    else if(luminance<.31)album.typography='nocturne';
    else if(saturation>.4)album.typography='poster';
    else if(contrast>.24)album.typography='brush';
    else album.typography='archive';
    if(albums[selected]?.id===album.id)applyTypography(album);
  };
  image.onerror=()=>{album.typography='archive';if(albums[selected]?.id===album.id)applyTypography(album)};
  image.src=coverDisplayUrl(album.cover);
}

function setTheme(album){
  const [accent,deep,paper]=album.palette;const root=document.documentElement;
  root.style.setProperty('--accent',accent);root.style.setProperty('--deep',deep);root.style.setProperty('--album-paper',paper);
  q('meta[name=theme-color]').content=accent;rim.color.set(accent);applyTypography(album);analyzeCoverTypography(album);
}

function updateUI(){
  const album=albums[selected];setTheme(album);
  q('.album-hit').disabled=album.id==='demo';
  q('.album-total').textContent=String(albums[0]?.id==='demo'?0:albums.length).padStart(2,'0');
  const titleLength=[...album.name].length,libraryCopy=q('.library-copy');document.documentElement.style.setProperty('--library-title-size',titleLength>38?'clamp(22px,2.25vw,32px)':titleLength>24?'clamp(27px,2.8vw,40px)':'clamp(32px,3.7vw,54px)');
  libraryCopy.classList.toggle('is-long-title',titleLength>24);libraryCopy.classList.toggle('is-ultra-title',titleLength>48);
  const detailCopy=q('.detail-copy');detailCopy.classList.toggle('is-long-title',titleLength>38);detailCopy.classList.toggle('is-ultra-title',titleLength>64);
  q('.album-title').textContent=album.name;q('.album-artist').textContent=album.artist;
  q('.album-index').textContent=albums[0]?.id==='demo'?'00 / 00':`${String(selected+1).padStart(2,'0')} / ${String(albums.length).padStart(2,'0')}`;
  q('.detail-title').textContent=album.name;q('.detail-artist').textContent=album.artist;q('.detail-year').textContent=album.year||'—';
  q('.catalogue').textContent=`CAT. 47—${String(selected+1).padStart(3,'0')}`;
  q('.mini-cover').style.backgroundImage=album.cover?`url('${coverDisplayUrl(album.cover)}')`:'none';
  bookletPage=Math.min(bookletPage,Math.max(0,album.tracks.length-1));renderTracks();renderTrackNote(bookletPage);
}

function trackContext(album,track,index){
  const facts=`《${track.name}》位于《${album.name}》的第 ${index+1} 首，由 ${album.artist} 发行于 ${album.year||'未标注年份'}，曲长 ${formatTime(track.duration/1000)}。`;
  const description=String(album.description||'').replace(/\s+/g,' ').trim();
  return description?`${facts} ${description}`:`${facts} 当前数据源没有提供创作说明，因此这里只保留可核对的曲目信息。`;
}

function splitNotePages(text,limit){
  const source=[...String(text||'').trim()],pages=[];let cursor=0;
  while(cursor<source.length){
    let end=Math.min(source.length,cursor+limit);
    if(end<source.length){
      const floor=cursor+Math.floor(limit*.58);let natural=end;
      while(natural>floor&&!/[。！？；.!?;，,\s]/.test(source[natural-1]))natural--;
      if(natural>floor)end=natural;
    }
    const page=source.slice(cursor,end).join('').trim();if(page)pages.push(page);cursor=end;
    while(cursor<source.length&&/\s/.test(source[cursor]))cursor++;
  }
  return pages.length?pages:['当前没有可展示的曲目说明。'];
}

function showNoteSubpage(index,direction=0){
  noteSubpage=Math.max(0,Math.min(notePages.length-1,index));const album=albums[selected],track=album?.tracks[bookletPage];if(!track)return;
  const panel=q('.panel-notes'),context=q('.note-context');panel.classList.remove('is-note-continuation');
  q('.note-title').textContent=track.name;context.textContent=notePages[noteSubpage];context.scrollTop=0;
  q('.note-page').textContent='FULL TEXT';q('.note-sheet').textContent='SCROLL ↓';
  q('.note-prev').disabled=true;q('.note-next').disabled=true;
  if(direction&&!reduceMotion)gsap.fromTo('.note-body',{rotationY:direction*14,x:direction*9,autoAlpha:.2},{rotationY:0,x:0,autoAlpha:1,transformOrigin:direction>0?'right center':'left center',duration:.38,ease:'power2.out',overwrite:'auto'});
}

function renderTrackNote(index=bookletPage){
  const album=albums[selected];if(!album)return;const track=album.tracks[index];if(!track)return;bookletPage=index;
  const trackTitleLength=[...track.name].length,notePanel=q('.panel-notes');notePanel.classList.toggle('has-long-track-title',trackTitleLength>34);notePanel.classList.toggle('has-ultra-track-title',trackTitleLength>64);
  q('.note-kicker').textContent=`TRACK NOTES / ${String(index+1).padStart(2,'0')}`;notePages=[trackContext(album,track,index)];noteSubpage=0;showNoteSubpage(0);
}

function renderTracks(){
  const album=albums[selected];if(!album)return;const split=Math.ceil(album.tracks.length/2),markup=(tracks,offset)=>tracks.map((track,index)=>`<li data-track="${index+offset}"><button type="button"><span>${String(index+offset+1).padStart(2,'0')}</span><strong>${escapeHtml(track.name)}</strong><time>${formatTime(track.duration/1000)}</time><i>▶</i></button></li>`).join('');
  q('.track-list-primary').innerHTML=markup(album.tracks.slice(0,split),0);q('.track-list-secondary').innerHTML=markup(album.tracks.slice(split),split);
  qa('.track-list li').forEach(li=>li.querySelector('button').addEventListener('click',()=>{const index=Number(li.dataset.track);renderTrackNote(index);playTrack(index)}));
}

function renderPlaylists(){
  const entries=playbackHistory.map(entry=>{const albumIndex=albums.findIndex(album=>String(album.id)===String(entry.albumId)),album=albums[albumIndex],index=album?.tracks.findIndex(track=>String(track.id)===String(entry.trackId))??-1,track=album?.tracks[index];return{entry,albumIndex,album,index,track}}).filter(item=>item.album&&item.track);
  q('.playlist-count').textContent=String(entries.length).padStart(2,'0');q('.playlist-runtime').textContent=entries.length?`LAST PLAY / ${formatHistoryTime(entries[0].entry.playedAt)}`:'LOCAL HISTORY';
  q('.playlist-list').innerHTML=entries.map((item,row)=>`<li data-album="${item.albumIndex}" data-track="${item.index}" class="${item.albumIndex===selected&&item.index===trackIndex&&playing?'playing':''}"><button type="button"><span>${String(row+1).padStart(3,'0')}</span><i></i><div><strong>${escapeHtml(item.track.name)}</strong><small>${escapeHtml(item.album.artist)} · ${escapeHtml(item.album.name)} · ${formatTime((item.track.duration||0)/1000)}</small></div><time>${formatHistoryTime(item.entry.playedAt)}</time><b>▶</b></button></li>`).join('')||'<li class="playlist-empty"><strong>还没有播放记录</strong><small>从任意专辑中播放一首歌，记录会保存在这里。</small></li>';
  qa('.playlist-list li[data-album]').forEach(li=>{li.querySelector('i').style.backgroundImage=`url("${coverDisplayUrl(albums[Number(li.dataset.album)]?.cover)}")`;li.querySelector('button').addEventListener('click',()=>{selected=Number(li.dataset.album);trackIndex=Number(li.dataset.track);bookletPage=trackIndex;layoutCollection(false);updateUI();playTrack(trackIndex)})});
}

function setMode(mode){
  if(mode==='playlists'&&opened){closeAlbum();setTimeout(()=>setMode(mode),420);return}
  const playlists=mode==='playlists';document.body.classList.toggle('playlist-mode',playlists);q('.library').setAttribute('aria-hidden',String(playlists));q('.playlists-view').setAttribute('aria-hidden',String(!playlists));
  q('.mode-albums').classList.toggle('active',!playlists);q('.mode-playlists').classList.toggle('active',playlists);q('.mode-albums').setAttribute('aria-pressed',String(!playlists));q('.mode-playlists').setAttribute('aria-pressed',String(playlists));
  if(playlists)renderPlaylists();
}

let albumSearchMatches=[];
function renderAlbumSearch(value=''){
  const query=String(value).trim().toLocaleLowerCase(),results=q('.album-search-results'),input=q('#album-search-input');
  albumSearchMatches=query?albums.map((album,index)=>({album,index})).filter(({album})=>`${album.name} ${album.artist}`.toLocaleLowerCase().includes(query)).slice(0,8):[];
  results.innerHTML=albumSearchMatches.map(({album,index})=>`<li><button type="button" data-index="${index}"><i></i><span><strong>${escapeHtml(album.name)}</strong><small>${escapeHtml(album.artist)}</small></span><b>→</b></button></li>`).join('')||(query?'<li class="search-empty">没有找到匹配的专辑</li>':'');
  qa('.album-search-results button[data-index]').forEach(button=>{button.querySelector('i').style.backgroundImage=`url("${coverDisplayUrl(albums[Number(button.dataset.index)]?.cover)}")`});
  results.classList.toggle('show',Boolean(query));input.setAttribute('aria-expanded',String(Boolean(query)));
}
function chooseSearchAlbum(index){
  const input=q('#album-search-input');if(index===selected){updateUI();layoutCollection(true)}else selectAlbum(index);input.value='';renderAlbumSearch('');input.blur();
}

function detailCoverPlacement(){
  const wrapRect=wrap.getBoundingClientRect(),bookletRect=q('.sleeve-fold').getBoundingClientRect(),distance=camera.position.z-.4;
  const visibleWorldHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*distance,worldPerPixel=visibleWorldHeight/Math.max(1,wrapRect.height);
  const naturalWidthPixels=(3.15*Math.cos(.18)+.24*Math.sin(.18))/worldPerPixel,availablePixels=Math.max(120,bookletRect.left-wrapRect.left-24);
  const preferredScale=innerWidth>1100?1.06:innerWidth>800?.98:innerWidth>500?.88:.74,scale=Math.max(.56,Math.min(preferredScale,availablePixels/naturalWidthPixels));
  const halfWidth=naturalWidthPixels*scale*.5,targetRight=bookletRect.left-wrapRect.left-12,centerPixels=Math.max(halfWidth+8,targetRight-halfWidth);
  return{x:(centerPixels-wrapRect.width*.5)*worldPerPixel,scale};
}

let selectionTimeline;
function selectAlbum(index){
  if(opened||albums.length<2)return;
  const next=(index+albums.length)%albums.length;if(next===selected)return;
  const direction=index>selected?1:-1;selectionTimeline?.kill();
  selected=next;trackIndex=0;bookletPage=0;layoutCollection(true);updateUI();
  selectionTimeline=gsap.timeline({defaults:{ease:'power3.out'}})
    .fromTo('.library-copy',{x:direction*24,autoAlpha:0},{x:0,autoAlpha:1,duration:reduceMotion?0:.48,immediateRender:false});
  gsap.fromTo(camera.position,{z:12.15},{z:12.5,duration:reduceMotion?0:.95,ease:'power3.out',overwrite:'auto'});
}

function openAlbum(){
  if(opened||albums[selected]?.id==='demo')return;opened=true;document.body.classList.add('album-open','album-opening');q('.detail').setAttribute('aria-hidden','false');
  const active=albumObjects[selected];
  const openingPlacement=detailCoverPlacement();
  selectionTimeline?.kill();albumObjects.forEach(object=>{gsap.killTweensOf(object.position);gsap.killTweensOf(object.rotation)});
  albumObjects.forEach((object,index)=>{object.visible=index===selected});
  active.userData.vinyl.visible=false;
  foldProgress=1;
  gsap.killTweensOf('.detail-copy,.sleeve-fold,.panel-notes,.fold-leaf-primary,.fold-leaf-secondary,.track-list li');
  gsap.set('.detail-copy',{x:-30,autoAlpha:0,force3D:true});
  gsap.set('.sleeve-fold',{x:90,autoAlpha:0,rotationY:-25,force3D:true});
  gsap.set('.panel-notes',{rotationY:0,autoAlpha:1,transformOrigin:'right center',force3D:true});
  gsap.set('.fold-leaf-primary',{rotationY:-168,transformOrigin:'left center',force3D:true});
  gsap.set('.fold-leaf-secondary',{rotationY:168,transformOrigin:'left center',force3D:true});
  gsap.set('.track-list li',{x:18,autoAlpha:0,force3D:true});
  const timeline=gsap.timeline({defaults:{ease:'power3.inOut',overwrite:'auto'},onStart:()=>q('.album-hit').setAttribute('aria-label','关闭当前专辑'),onComplete:()=>document.body.classList.remove('album-opening')});
  timeline.addLabel('open',.04)
    .to(floor.material,{opacity:.08,duration:reduceMotion?0:.45,ease:'power2.out'},'open')
    .to(active.position,{x:openingPlacement.x,y:0,z:.4,duration:reduceMotion?0:1.05},'open')
    .to(active.rotation,{y:-.18,z:-.025,duration:reduceMotion?0:1.05},'open')
    .to(active.scale,{x:openingPlacement.scale,y:openingPlacement.scale,z:openingPlacement.scale,duration:reduceMotion?0:1.05},'open')
    .to('.detail-copy',{x:0,autoAlpha:1,duration:reduceMotion?0:.5},'open+=.24')
    .to('.sleeve-fold',{x:0,autoAlpha:1,rotationY:0,duration:reduceMotion?0:.72},'open+=.3')
    .to('.fold-leaf-primary',{rotationY:0,duration:reduceMotion?0:.86,ease:'power2.inOut'},'open+=.42')
    .to('.fold-leaf-secondary',{rotationY:0,duration:reduceMotion?0:.86,ease:'power2.inOut'},'open+=.7')
    .to('.track-list li',{x:0,autoAlpha:1,stagger:.028,duration:reduceMotion?0:.24,ease:'power2.out'},'open+=.94');
}

function closeAlbum(){
  if(!opened)return;const finish=()=>{opened=false;floor.material.opacity=.23;document.body.classList.remove('album-open','album-opening');q('.detail').setAttribute('aria-hidden','true');gsap.set('.detail,.detail-copy,.sleeve-fold,.panel-notes,.fold-leaf,.panel-tracks,.track-list li',{clearProps:'all'});albumObjects.forEach(object=>{object.visible=true;object.userData.vinyl.visible=true});layoutCollection(false)};
  if(reduceMotion){finish();return}
  gsap.timeline({onComplete:finish}).to('.detail-copy,.sleeve-fold',{autoAlpha:0,x:35,duration:.32,ease:'power2.in'}).to(floor.material,{opacity:.23,duration:.35,ease:'power2.out'},0).call(()=>layoutCollection(true),[],.12).to('.detail',{autoAlpha:0,duration:.35},.08);
}

function formatTime(value=0){const s=Math.max(0,Math.round(value));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function formatHistoryTime(value){const date=new Date(Number(value)||Date.now()),now=new Date(),time=`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;return date.toDateString()===now.toDateString()?`今天 ${time}`:`${date.getMonth()+1}.${date.getDate()} ${time}`}
function recordPlayback(album,track){const entry={albumId:String(album.id),trackId:String(track.id),playedAt:Date.now()};playbackHistory=[entry,...playbackHistory.filter(item=>!(String(item.albumId)===entry.albumId&&String(item.trackId)===entry.trackId))].slice(0,100);localStorage.setItem(currentUser?`degree47-history-${currentUser.id}`:'degree33-playback-history',JSON.stringify(playbackHistory));if(document.body.classList.contains('playlist-mode'))renderPlaylists()}

async function playTrack(index=trackIndex){
  const album=albums[selected];if(!album)return;const track=album.tracks[index];if(!track)return;trackIndex=index;
  renderTrackNote(index);
  q('.player-copy strong').textContent=track.name;q('.player-copy small').textContent=`${album.artist} · ${album.name}`;q('.duration').textContent=formatTime(track.duration/1000);
  qa('.track-list li').forEach((li,i)=>li.classList.toggle('playing',i===index));
  qa('.playlist-list li').forEach(li=>li.classList.toggle('playing',Number(li.dataset.album)===selected&&Number(li.dataset.track)===index));
  const source=`/api/netease/audio?id=${encodeURIComponent(track.id)}`;
  if(audio.dataset.track!==String(track.id)){audio.src=source;audio.dataset.track=String(track.id)}
  try{await audio.play();recordPlayback(album,track)}catch{showToast('这首歌受网易云版权或登录限制，当前只能浏览专辑信息')}
}

function setPlaying(value){playing=value;document.body.classList.toggle('is-playing',value);q('.play span').textContent=value?'Ⅱ':'▶';q('.play').ariaLabel=value?'暂停':'播放';albumObjects.forEach((o,i)=>{if(i===selected)o.userData.playing=value});qa('.playlist-list li[data-album]').forEach(li=>li.classList.toggle('playing',value&&Number(li.dataset.album)===selected&&Number(li.dataset.track)===trackIndex))}

function extractId(value){const text=value.trim();if(/^\d+$/.test(text))return text;return text.match(/[?&]id=(\d+)/)?.[1]||text.match(/\/album\/?(\d+)/)?.[1]||text.match(/album%3Fid%3D(\d+)/i)?.[1]||null}
function normalize(raw,id){const source=raw.album||raw,songs=raw.songs||source.songs||[],artist=source.artist?.name||source.artists?.map(a=>a.name).join(' / ')||songs[0]?.ar?.map(a=>a.name).join(' / ')||'未知艺人';const hash=[...String(id)].reduce((n,c)=>n+Number(c),0),original=(source.picUrl||source.blurPicUrl||songs[0]?.al?.picUrl||'').replace(/^http:/,'https:');return{id:String(id),name:source.name||songs[0]?.al?.name||`Album ${id}`,artist,year:source.publishTime?new Date(source.publishTime).getFullYear():'—',description:source.description||source.briefDesc||'',cover:directCoverUrl(original),palette:palettes[hash%palettes.length],tracks:songs.map(s=>({id:String(s.id),name:s.name,duration:s.dt||s.duration||0}))}}

function normalizeSingle(raw,id){const song=raw.songs?.[0];if(!song)return null;const source=song.album||song.al||{},artist=(song.artists||song.ar||[]).map(item=>item.name).join(' / ')||'未知艺人',hash=[...String(id)].reduce((n,c)=>n+Number(c),0),original=(source.picUrl||source.blurPicUrl||'').replace(/^http:/,'https:');return{id:`single-${id}`,name:song.name,artist,year:source.publishTime?new Date(source.publishTime).getFullYear():'—',description:`作为独立单曲收录。原始专辑：${source.name||song.name}。`,cover:directCoverUrl(original),palette:palettes[hash%palettes.length],tracks:[{id:String(song.id),name:song.name,duration:song.dt||song.duration||0}]}}

async function saveAlbum(album){
  if(!accountEnabled)return;
  const response=await fetch('/api/albums',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({album})});
  if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||'保存失败');
}

function persistLocalLibrary(){
  if(!accountEnabled)localStorage.setItem('degree33-albums',JSON.stringify(albums.filter(album=>album.id!=='demo')));
}

function enterLocalLibrary(){
  let stored=[];try{stored=JSON.parse(localStorage.getItem('degree33-albums')||'[]')}catch{}
  albums=stored.length?stored:[demo];selected=0;bookletPage=0;
  try{playbackHistory=JSON.parse(localStorage.getItem('degree33-playback-history')||'[]');if(!Array.isArray(playbackHistory))playbackHistory=[]}catch{playbackHistory=[]}
  rebuildCollection();q('.auth-screen').hidden=true;qa('.topbar,main,.player').forEach(element=>element.inert=false);
  q('.account-logout').hidden=true;
}

async function enterUser(user){
  currentUser=user;
  const response=await fetch('/api/albums');if(!response.ok)throw new Error('无法读取唱片架');
  const data=await response.json();
  albums=data.length?data.map(album=>({...album,cover:directCoverUrl(album.cover)})):[demo];
  selected=0;bookletPage=0;
  try{playbackHistory=JSON.parse(localStorage.getItem(`degree47-history-${user.id}`)||'[]');if(!Array.isArray(playbackHistory))playbackHistory=[]}catch{playbackHistory=[]}
  rebuildCollection();
  q('.auth-screen').hidden=true;
  qa('.topbar,main,.player').forEach(element=>element.inert=false);
  q('.account-logout').title=`${user.email||'当前账号'} · 退出登录`;
}

let authMode='login';
function setAuthMode(mode){
  authMode=mode;
  q('.auth-password').required=mode!=='forgot';
  q('.auth-password').closest('label').hidden=mode==='forgot';
  q('.auth-password').autocomplete=mode==='login'?'current-password':'new-password';
  q('.auth-email').closest('label').hidden=mode==='reset';
  q('.auth-email').required=mode!=='reset';
  q('.auth-submit').firstChild.textContent=mode==='register'?'创建账号 ':mode==='forgot'?'发送重置邮件 ':mode==='reset'?'设置新密码 ':'登录唱片室 ';
  q('.auth-switch').textContent=mode==='login'?'没有账号？注册':'返回登录';
  q('.auth-forgot').hidden=mode!=='login';
  q('.auth-status').textContent='';
}
q('.auth-switch').addEventListener('click',()=>setAuthMode(authMode==='login'?'register':'login'));
q('.auth-forgot').addEventListener('click',()=>{q('.auth-status').textContent='请联系站点管理员重置密码。'});
q('.auth-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!accountEnabled)return;
  const email=q('.auth-email').value.trim(),password=q('.auth-password').value,status=q('.auth-status'),submit=q('.auth-submit');
  submit.disabled=true;status.textContent='正在处理…';
  try{
    const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:authMode,email,password})});
    const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'认证失败');
    await enterUser(result.user);
  }catch(error){
    const raw=String(error?.message||'');
    status.textContent=raw.includes('Unexpected end of JSON input')
      ? '认证服务刚完成配置，请刷新页面后重新登录或注册。'
      : (raw||'登录失败，请稍后再试。');
  }finally{submit.disabled=false}
});
q('.account-logout').addEventListener('click',async()=>{await fetch('/api/auth',{method:'DELETE'});location.reload()});

async function initializeAccount(){
  const status=q('.auth-status'),submit=q('.auth-submit');submit.disabled=true;
  try{
    const response=await fetch('/api/auth');if(!response.ok)throw new Error('账号服务未配置');
    const {user}=await response.json();accountEnabled=true;
    if(user)await enterUser(user);else status.textContent='登录或注册后，你的唱片架将从空白开始。';
    submit.disabled=false;
  }catch(error){
    if(!accountEnabled&&['localhost','127.0.0.1'].includes(location.hostname)){enterLocalLibrary();return}
    status.textContent=`无法连接账号服务：${error.message}`;
  }
}

q('.import-dialog form').addEventListener('submit',async event=>{
  event.preventDefault();const input=q('#album-link'),status=q('.import-status'),id=extractId(input.value);if(!id){status.textContent='没有识别到专辑 ID，请粘贴专辑页链接。';status.className='import-status error';return}
  status.textContent='正在取出封面、曲目和唱片信息…';status.className='import-status loading';
  try{const response=await fetch(`/api/netease/album?id=${id}`);if(!response.ok)throw new Error();const album=normalize(await response.json(),id);if(!album.cover||!album.tracks.length)throw new Error();
    await saveAlbum(album);albums=albums.filter(a=>a.id!=='demo'&&a.id!==album.id);albums.unshift(album);selected=0;persistLocalLibrary();rebuildCollection();
    status.textContent=`《${album.name}》已放入唱片室，共 ${album.tracks.length} 首。`;status.className='import-status success';setTimeout(()=>{q('.import-dialog').close();openAlbum()},650)
  }catch{status.textContent='解析失败。请确认这是公开的网易云专辑链接后重试。';status.className='import-status error'}
});

q('.import-open').addEventListener('click',()=>{q('.import-dialog').showModal();setTimeout(()=>q('#album-link').focus(),80)});q('.dialog-close').addEventListener('click',()=>q('.import-dialog').close());q('.import-dialog').addEventListener('click',e=>{if(e.target===q('.import-dialog'))q('.import-dialog').close()});
function resetDeleteAction(){const button=q('.manage-delete');button.dataset.armed='false';button.textContent='删除唱片';q('.manage-status').textContent='修改会保存在你的个人唱片室中。';q('.manage-status').className='manage-status'}
function openManageDialog(){
  if(opened){closeAlbum();setTimeout(openManageDialog,450);return}
  const album=albums[selected];if(!album||album.id==='demo')return;const dialog=q('.manage-dialog');
  q('.manage-name').value=album.name||'';q('.manage-artist').value=album.artist||'';q('.manage-year').value=album.year||'';q('.manage-description').value=album.description||'';
  q('.manage-cover').style.backgroundImage=album.cover?`url('${coverDisplayUrl(album.cover)}')`:'none';resetDeleteAction();dialog.showModal();setTimeout(()=>q('.manage-name').focus(),80);
}
q('.manage-dialog form').addEventListener('submit',async event=>{
  event.preventDefault();const album=albums[selected];if(!album)return;
  const updated={...album,name:q('.manage-name').value.trim()||album.name,artist:q('.manage-artist').value.trim()||album.artist,year:q('.manage-year').value.trim()||'—',description:q('.manage-description').value.trim()};
  try{await saveAlbum(updated);albums[selected]=updated;persistLocalLibrary();q('.manage-dialog').close();rebuildCollection();showToast(`《${updated.name}》已更新`)}catch{q('.manage-status').textContent='保存失败，请检查网络后重试。';q('.manage-status').className='manage-status warning'}
});
q('.manage-delete').addEventListener('click',async event=>{
  const button=event.currentTarget;if(button.dataset.armed!=='true'){button.dataset.armed='true';button.textContent='再次点击确认删除';q('.manage-status').textContent='再次点击将从你的账号删除此唱片，无法在页面内撤销。';q('.manage-status').className='manage-status warning';clearTimeout(resetDeleteAction.timer);resetDeleteAction.timer=setTimeout(resetDeleteAction,3500);return}
  clearTimeout(resetDeleteAction.timer);const removed=albums[selected];button.disabled=true;
  const response=accountEnabled?await fetch('/api/albums',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:String(removed.id)})}):{ok:true};button.disabled=false;
  if(!response.ok){q('.manage-status').textContent='删除失败，请检查网络后重试。';return}
  albums.splice(selected,1);if(!albums.length)albums=[demo];selected=Math.min(selected,albums.length-1);trackIndex=0;bookletPage=0;persistLocalLibrary();q('.manage-dialog').close();rebuildCollection();showToast(`《${removed.name}》已从唱片室删除`);
});
q('.manage-close').addEventListener('click',()=>q('.manage-dialog').close());q('.manage-dialog').addEventListener('click',event=>{if(event.target===q('.manage-dialog'))q('.manage-dialog').close()});q('.manage-dialog').addEventListener('close',()=>{clearTimeout(resetDeleteAction.timer);resetDeleteAction()});
let suppressAlbumClick=false,albumClickTimer;
q('.album-hit').addEventListener('click',event=>{
  if(suppressAlbumClick){event.preventDefault();suppressAlbumClick=false;clearTimeout(albumClickTimer);return}
  clearTimeout(albumClickTimer);
  if(event.detail>=3){event.preventDefault();openManageDialog();return}
  if(event.detail===1)albumClickTimer=setTimeout(()=>opened?closeAlbum():openAlbum(),280);
});q('.detail-back').addEventListener('click',closeAlbum);q('.logo').addEventListener('click',()=>document.body.classList.contains('playlist-mode')?setMode('albums'):(opened?closeAlbum():selectAlbum(0)));q('.mini-cover').addEventListener('click',()=>{if(!opened)openAlbum()});
q('.mode-albums').addEventListener('click',()=>setMode('albums'));q('.mode-playlists').addEventListener('click',()=>setMode('playlists'));
q('#album-search-input').addEventListener('input',event=>renderAlbumSearch(event.currentTarget.value));q('#album-search-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&albumSearchMatches.length){event.preventDefault();chooseSearchAlbum(albumSearchMatches[0].index)}if(event.key==='Escape'){event.currentTarget.value='';renderAlbumSearch('')}});q('.album-search-results').addEventListener('click',event=>{const button=event.target.closest('button[data-index]');if(button)chooseSearchAlbum(Number(button.dataset.index))});q('.album-search-clear').addEventListener('click',()=>{const input=q('#album-search-input');input.value='';renderAlbumSearch('');input.focus()});
q('.previous').addEventListener('click',()=>selectAlbum(selected-1));q('.next').addEventListener('click',()=>selectAlbum(selected+1));q('.prev-track').addEventListener('click',()=>{const tracks=albums[selected]?.tracks;if(tracks?.length)playTrack((trackIndex-1+tracks.length)%tracks.length)});q('.next-track').addEventListener('click',()=>{const tracks=albums[selected]?.tracks;if(tracks?.length)playTrack((trackIndex+1)%tracks.length)});q('.play').addEventListener('click',()=>playing?audio.pause():playTrack(trackIndex));
q('.note-prev').addEventListener('click',()=>showNoteSubpage(noteSubpage-1,-1));q('.note-next').addEventListener('click',()=>showNoteSubpage(noteSubpage+1,1));
q('.panel-notes').addEventListener('wheel',event=>{const context=q('.note-context');if(!opened||context.scrollHeight<=context.clientHeight)return;event.preventDefault();event.stopPropagation();const delta=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;context.scrollTop+=delta},{passive:false});
audio.addEventListener('play',()=>setPlaying(true));audio.addEventListener('pause',()=>setPlaying(false));audio.addEventListener('ended',()=>q('.next-track').click());audio.addEventListener('error',()=>{setPlaying(false);showToast('音频地址不可用；网易云可能要求登录或拥有版权权限')});audio.addEventListener('loadedmetadata',()=>q('.duration').textContent=formatTime(audio.duration));audio.addEventListener('timeupdate',()=>{q('.elapsed').textContent=formatTime(audio.currentTime);q('.progress i').style.width=`${audio.duration?audio.currentTime/audio.duration*100:0}%`});
q('.progress button').addEventListener('click',e=>{if(audio.duration){const r=e.currentTarget.getBoundingClientRect();audio.currentTime=(e.clientX-r.left)/r.width*audio.duration}});

let drag=null;
wrap.addEventListener('pointerdown',e=>{if(opened)return;drag={pointerId:e.pointerId,x:e.clientX,moved:false}});
wrap.addEventListener('pointermove',e=>{if(!drag||drag.pointerId!==e.pointerId)return;const d=e.clientX-drag.x;if(Math.abs(d)>25){if(!drag.moved){drag.moved=true;suppressAlbumClick=true;wrap.setPointerCapture?.(e.pointerId)}selectAlbum(selected+(d<0?1:-1));drag.x=e.clientX}});
wrap.addEventListener('pointerup',e=>{if(!drag||drag.pointerId!==e.pointerId)return;const moved=drag.moved;drag=null;if(wrap.hasPointerCapture?.(e.pointerId))wrap.releasePointerCapture(e.pointerId);if(moved)setTimeout(()=>{suppressAlbumClick=false},0)});
wrap.addEventListener('pointercancel',()=>{drag=null;suppressAlbumClick=false});

const booklet=q('.sleeve-fold'),foldPrimary=q('.fold-leaf-primary'),foldSecondary=q('.fold-leaf-secondary');
let foldProgress=1,foldDrag=null,pageFoldTween;
function setFoldProgress(value){
  foldProgress=Math.max(0,Math.min(1,value));const angle=168*(1-foldProgress);
  gsap.set(foldPrimary,{rotationY:-angle,transformOrigin:'left center'});gsap.set(foldSecondary,{rotationY:angle,transformOrigin:'left center'});
}
function animateFold(target){
  target=Math.max(0,Math.min(1,target));pageFoldTween?.kill();
  if(reduceMotion){setFoldProgress(target);return}
  const state={value:foldProgress};pageFoldTween=gsap.to(state,{value:target,duration:.72,ease:'power3.inOut',overwrite:'auto',onUpdate:()=>setFoldProgress(state.value)});
}
booklet.addEventListener('pointerdown',event=>{if(!opened||event.target.closest('button'))return;pageFoldTween?.kill();foldDrag={pointerId:event.pointerId,startX:event.clientX,startProgress:foldProgress,moved:false}});
booklet.addEventListener('pointermove',event=>{
  if(!foldDrag||foldDrag.pointerId!==event.pointerId)return;const dx=event.clientX-foldDrag.startX;
  if(!foldDrag.moved&&Math.abs(dx)>8){foldDrag.moved=true;booklet.setPointerCapture?.(event.pointerId)}
  if(foldDrag.moved)setFoldProgress(foldDrag.startProgress+dx/Math.max(180,booklet.offsetWidth*1.45));
});
function endFoldDrag(event,cancelled=false){
  if(!foldDrag||foldDrag.pointerId!==event.pointerId)return;const moved=foldDrag.moved,start=foldDrag.startProgress;foldDrag=null;if(booklet.hasPointerCapture?.(event.pointerId))booklet.releasePointerCapture(event.pointerId);
  if(moved)animateFold(cancelled?start:(foldProgress>.52?1:0));
}
booklet.addEventListener('pointerup',event=>endFoldDrag(event));booklet.addEventListener('pointercancel',event=>endFoldDrag(event,true));
booklet.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();animateFold(1)}if(event.key==='ArrowLeft'){event.preventDefault();animateFold(0)}});

let wheelDistance=0,wheelReset;
q('.library').addEventListener('wheel',e=>{
  if(opened||albums.length<2)return;
  e.preventDefault();
  const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
  wheelDistance+=delta;
  if(Math.abs(wheelDistance)>=34){
    selectAlbum(selected+(wheelDistance>0?1:-1));
    wheelDistance=0;
  }
  clearTimeout(wheelReset);
  wheelReset=setTimeout(()=>{wheelDistance=0},140);
},{passive:false});

let pointer={x:0,y:0};wrap.addEventListener('pointermove',e=>{const r=wrap.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width-.5;pointer.y=(e.clientY-r.top)/r.height-.5});wrap.addEventListener('pointerleave',()=>pointer={x:0,y:0});
function resize(){const r=wrap.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();collection.scale.setScalar(r.width<700?.78:1);if(opened&&albumObjects[selected]){const placement=detailCoverPlacement(),active=albumObjects[selected];gsap.set(active.position,{x:placement.x});gsap.set(active.scale,{x:placement.scale,y:placement.scale,z:placement.scale})}}
const clock=new THREE.Clock();function render(){const delta=Math.min(clock.getDelta(),.05);collection.rotation.y+=(pointer.x*.035-collection.rotation.y)*.035;collection.rotation.x+=(-pointer.y*.025-collection.rotation.x)*.035;albumObjects.forEach(o=>{if(o.userData.playing)o.userData.vinyl.rotation.z-=delta*1.35});renderer.render(scene,camera);requestAnimationFrame(render)}
function showToast(message){const t=q('.toast');t.textContent=message;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),3200)}
addEventListener('resize',resize);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened)closeAlbum();if(e.key==='ArrowLeft')selectAlbum(selected-1);if(e.key==='ArrowRight')selectAlbum(selected+1)});
rebuildCollection();resize();render();setTimeout(()=>document.body.classList.add('ready'),350);initializeAccount();
