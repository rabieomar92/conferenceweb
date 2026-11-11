'use strict';
const C=window.QH_C, B=C.base||'';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cur=0; const st=document.getElementById('st'), prev=document.getElementById('prev');

function qrUrl(text){const q=qrcode(0,'M');q.addData(text);q.make();return q.createDataURL(6,0)}
/* ── The certificate is drawn straight onto a canvas (1123×794 CSS px at 2×): exact positions, no DOM or html2canvas quirks, and fast for big batches. ── */
const W=1123,H=794,K=2,NAVY='#12285C',AMB='#B07800',MUTE='#6E7790',BODY='#46506A';
const SERIF="'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif",SANS="'TeX Gyre Pagella','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif";
const imgCache={};
function loadImg(src){return imgCache[src]||(imgCache[src]=new Promise(r=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src}))}
let fontsOk=null;
function loadFonts(){return fontsOk||(fontsOk=Promise.all(['700 44px "TeX Gyre Pagella"','italic 700 40px "TeX Gyre Pagella"','400 15px "TeX Gyre Pagella"','italic 400 15px "TeX Gyre Pagella"'].map(f=>document.fonts.load(f,'Aa 0123456789'))).then(()=>document.fonts.ready))}
// text helpers: digits always in the sans face; optional letter-spacing drawn glyph by glyph
function runs(t){return String(t).split(/([0-9]+(?:[.,:][0-9]+)*)/).filter(Boolean).map(x=>({t:x,d:/^[0-9]/.test(x)}))}
function fnt(o,d){const sz=o.size;if(d&&o.serif)return `600 ${sz}px ${SANS}`;return `${o.style||''} ${o.w||400} ${sz}px ${o.serif?SERIF:SANS}`.trim()}
function width(g,t,o){let w=0;for(const r of runs(t)){g.font=fnt(o,r.d);w+=o.ls?[...r.t].reduce((a,c)=>a+g.measureText(c).width+o.ls,0):g.measureText(r.t).width}return w}
function text(g,t,x,y,o){ // x = centre unless o.left / o.right
  const w=width(g,t,o);let cx=o.left?x:o.right?x-w:x-w/2+(o.ls?o.ls/2:0);g.fillStyle=o.c;g.textBaseline='alphabetic';
  for(const r of runs(t)){g.font=fnt(o,r.d);
    if(o.ls){for(const c of r.t){g.fillText(c,cx,y);cx+=g.measureText(c).width+o.ls}}
    else{g.fillText(r.t,cx,y);cx+=g.measureText(r.t).width}}
}
function wrap(g,t,o,max,lines){ // greedy word wrap; last line gets an ellipsis if text is cut
  const words=String(t).trim().split(/\s+/).filter(Boolean),out=[];let cur='';
  for(const w of words){const n=cur?cur+' '+w:w;if(width(g,n,o)<=max||!cur)cur=n;else{out.push(cur);cur=w}}
  if(cur)out.push(cur);
  if(out.length>lines){const keep=out.slice(0,lines);let l=keep[lines-1]+' '+out.slice(lines).join(' ');while(l.length>1&&width(g,l+'…',o)>max)l=l.slice(0,-1);keep[lines-1]=l.trim()+'…';return keep}
  return out;
}
const row=(g,t,o)=>({o,t,h:o.lh});
async function drawCert(p){
  await loadFonts();
  const cv=document.createElement('canvas');cv.width=W*K;cv.height=H*K;const g=cv.getContext('2d');g.scale(K,K);g.imageSmoothingQuality='high';
  const [mass,sop,apex,sig,qr]=await Promise.all([Promise.resolve(null),loadImg(B+'/assets/sop-w.png'),loadImg(B+'/assets/usm-apex-w.png'),C.sigImg?loadImg(C.sigImg):null,
    loadImg(qrUrl(location.origin+B+'/verify?c='+encodeURIComponent(p.ref)))]);
  // page + crown
  g.fillStyle='#F8F7F4';g.fillRect(0,0,W,H);
  g.fillStyle=NAVY;g.fillRect(0,0,W,124);g.fillStyle=AMB;g.fillRect(0,124,W,3);
  g.strokeStyle='#F2A900';g.lineWidth=1;g.strokeRect(.5,.5,W-1,H-1);
  // "CERTIFICATE" tag
  const tg={size:13,w:700,c:NAVY,ls:4},tw=width(g,'CERTIFICATE',tg)-tg.ls+48;
  g.fillStyle=AMB;g.fillRect(70,43,tw,38);text(g,'CERTIFICATE',70+24,43+24,{...tg,left:true});
  // logos, right-aligned: heights 50 / 38 / 56 with hairline dividers
  const logos=[[mass,72],[sop,46],[apex,38]].filter(l=>l[0]).map(([i,h])=>({i,h,w:h*i.naturalWidth/i.naturalHeight}));
  let lx=W-70-(logos.reduce((a,l)=>a+l.w,0)+52*(logos.length-1)+Math.max(0,logos.length-1)*1);
  logos.forEach((l,k)=>{if(l.i===mass){g.fillStyle='#fff';g.beginPath();g.arc(lx+l.w/2,62,l.h/2+5,0,6.2832);g.fill()}g.drawImage(l.i,lx,(124-l.h)/2,l.w,l.h);lx+=l.w;if(k<logos.length-1){lx+=26;g.fillStyle='rgba(255,255,255,.25)';g.fillRect(lx,(124-46)/2,1,46);lx+=27}});
  // frame
  g.strokeStyle='rgba(176,120,0,.45)';g.strokeRect(34.5,147.5,W-69,592);
  // centred text stack (vertically centred between frame top and footer)
  const cx=W/2,top=147,bot=622,rows=[];
  const add=(t,o,mt=0,mb=0)=>rows.push({t,o,mt,mb});
  add(`${C.event}  ·  Penang, Malaysia`.toUpperCase(),{size:12,w:700,c:AMB,ls:5,lh:16},0,16);
  add('Certificate of Participation',{size:44,w:700,serif:1,c:NAVY,lh:51},0,16);
  add('This is to certify that',{size:15,c:MUTE,lh:20},0,0);
  // name: one line if it fits, otherwise shrink, finally wrap
  let ns=58,no={size:ns,w:600,style:'italic',serif:1,c:NAVY};
  while(width(g,p.full_name,no)>860&&ns>34){ns-=2;no.size=ns}
  let nl=[p.full_name];if(width(g,p.full_name,no)>860){no.size=34;nl=wrap(g,p.full_name,no,900,3);if(nl.length>2){no.size=28;nl=wrap(g,p.full_name,no,900,3)}}
  nl.forEach((l,i)=>add(l,{...no,lh:Math.round(no.size*1.28)},i?0:8,i===nl.length-1?6:0));
  if(String(p.organisation||'').trim())wrap(g,p.organisation,{size:16,c:MUTE},800,2).forEach((l,i,a)=>add(l,{size:16,c:MUTE,lh:22},0,i===a.length-1?14:0));
  else rows[rows.length-1].mb=14;
  rows.push({rule:1,mb:14,mt:0});
  const role=/oral/i.test(p.participation||'')?'an oral presenter':/poster/i.test(p.participation||'')?'a poster presenter':'';
  add(role?`has participated as ${role} in the`:'has participated in the',{size:15,c:MUTE,lh:20},0,0);
  wrap(g,C.full||C.event,{size:28,w:700,serif:1},900,2).forEach((l,i)=>add(l,{size:28,w:700,serif:1,c:NAVY,lh:35},i?0:6,0));
  if(String(C.sub||'').trim())wrap(g,C.sub,{size:15},820,2).forEach((l,i)=>add(l,{size:15,c:BODY,lh:21},i?0:4,0));
  wrap(g,`${C.date}  ·  ${C.venue}`,{size:14},900,2).forEach((l,i)=>add(l,{size:14,c:BODY,lh:20},i?0:8,0));
  const hOf=r=>r.rule?2:r.o.lh;let tot=0;rows.forEach(r=>{tot+=(r.mt||0)+hOf(r)+(r.mb||0)});
  let y=top+(bot-top-tot)/2+5;  // +5: body padding is 14 top / 4 bottom
  for(const r of rows){y+=r.mt||0;
    if(r.rule){g.fillStyle=AMB;g.fillRect(cx-40,y,80,2)}
    else{const asc=r.o.size*(r.o.serif?.82:.78)+(r.o.lh-r.o.size*1.2)/2+r.o.size*.1;text(g,r.t,cx,y+asc+(r.o.lh-r.o.size)/2-r.o.size*.1,r.o)}
    y+=hOf(r)+(r.mb||0)}
  // footer: signature (left) and QR (right), bottom aligned at 720
  const fb=720,sx=90+170;
  const st=wrap(g,C.sigTitle||'',{size:12},340,2);
  let yy=fb-st.length*16.8;st.forEach((l,i)=>text(g,l,sx,yy+i*16.8+12,{size:12,c:MUTE}));
  yy-=3+18.9;text(g,C.sigName||'',sx,yy+14,{size:14.5,w:700,c:NAVY});
  yy-=9;g.fillStyle=NAVY;g.fillRect(sx-170,yy,340,1);
  if(sig){const h=56,w=Math.min(300,h*sig.naturalWidth/sig.naturalHeight),hh=w/(sig.naturalWidth/sig.naturalHeight);g.drawImage(sig,sx-w/2,yy-4-hh,w,hh)}
  const qx=W-34-56-65;
  g.imageSmoothingEnabled=false;if(qr)g.drawImage(qr,qx-36,fb-72-5-15-14-2,72,72);g.imageSmoothingEnabled=true;
  text(g,'CERTIFICATE NO.',qx,fb-5-14-2+1,{size:9.5,c:MUTE,ls:2});text(g,p.ref,qx,fb-2,{size:12,w:700,c:NAVY});
  // supporter strip
  g.fillStyle='#fff';g.fillRect(1,754,W-2,39);g.fillStyle='#DDD8CE';g.fillRect(1,754,W-2,1);
  text(g,'ORGANISED BY THE SCHOOL OF PHYSICS, UNIVERSITI SAINS MALAYSIA',W/2,754+20+3,{size:9,c:MUTE,ls:2});
  return cv;
}
async function render(p){return drawCert(p)}
function pdfOf(canvas){
  const {jsPDF}=window.jspdf; const d=new jsPDF({orientation:'landscape',unit:'px',format:[1123,794],hotfixes:['px_scaling']});
  d.addImage(canvas.toDataURL('image/jpeg',.86),'JPEG',0,0,1123,794); return d;
}
const fname=p=>'Certificate_'+p.full_name.replace(/[^\w\-]+/g,'_').replace(/^_+|_+$/g,'')+'_'+p.ref+'.pdf';
async function issue(ids){
  const b=new URLSearchParams({csrf:C.csrf,action:'issue'}); ids.forEach(i=>b.append('ids',i));
  try{await fetch(B+'/admin/action',{method:'POST',body:b,credentials:'same-origin'})}catch(e){}
}
/* ── participants are loaded in small batches, so the list can hold 100k+ people ── */
window.ICCert={render,pdfOf,fname};
if(document.getElementById('list')){ // ── admin batch page only ──
const PAGE=100, CH=100; let P=[], total=C.total;
const listEl=document.getElementById('list');
const more=document.createElement('button'); more.className='it more'; more.textContent='Load more…';
async function fetchRows(extra){
  const r=await fetch(B+'/admin/certificates.json?'+C.src+'&'+extra,{credentials:'same-origin'});
  if(!r.ok) throw new Error('Could not load participants ('+r.status+')');
  return (await r.json()).rows;
}
function addItems(rows){
  rows.forEach(p=>{const i=P.length;P.push(p);const b=document.createElement('button');b.className='it';
    b.innerHTML=esc(p.full_name)+'<small>'+esc(p.ref)+'</small>';b.onclick=()=>show(i);listEl.insertBefore(b,more)});
  more.hidden=P.length>=total; more.textContent='Load the next '+Math.min(PAGE,total-P.length).toLocaleString('en-US');
  const cnt=document.getElementById('cnt'); if(cnt) cnt.textContent=P.length>=total?total.toLocaleString('en-US')+' people':P.length.toLocaleString('en-US')+' of '+total.toLocaleString('en-US')+' loaded';
  filter();
}
const find=document.getElementById('find');
function filter(){ if(!find) return; const q=find.value.trim().toLowerCase();
  [...listEl.querySelectorAll('.it:not(.more)')].forEach((b,k)=>{const p=P[k];b.hidden=!!q&&!(p.full_name+' '+p.ref+' '+(p.organisation||'')).toLowerCase().includes(q)});}
if(find) find.addEventListener('input',filter);
more.onclick=async()=>{more.disabled=true;try{addItems(await fetchRows('limit='+PAGE+'&offset='+P.length))}catch(e){st.textContent=e.message}more.disabled=false};
listEl.appendChild(more);
async function show(i){
  cur=i; [...listEl.querySelectorAll('.it:not(.more)')].forEach((b,k)=>b.classList.toggle('on',k===i));
  const nm=document.getElementById('pvName'),rf=document.getElementById('pvRef'); if(nm){nm.textContent=P[i].full_name;rf.textContent=P[i].ref+(P[i].organisation?' · '+P[i].organisation:'')}
  st.textContent='Rendering…'; prev.classList.add('busy'); const c=await render(P[i]); prev.src=c.toDataURL('image/jpeg',.9); prev.classList.remove('busy'); st.textContent='';
}
document.getElementById('one').onclick=async()=>{
  st.textContent='Preparing PDF…'; const p=P[cur]; const c=await render(p); pdfOf(c).save(fname(p)); await issue([p.id]); st.textContent='Downloaded.';};
let stop=false; const stopbtn=document.getElementById('stopbtn'), allbtn=document.getElementById('allbtn');
stopbtn.onclick=()=>{stop=true;st.textContent='Stopping after the current certificate…'};
const pad=n=>String(n).padStart(4,'0');
allbtn.onclick=async()=>{
  if(total>CH&&!await ui.confirm('This will download '+Math.ceil(total/CH).toLocaleString('en-US')+' ZIP files ('+CH+' certificates each) one after another. Your browser may ask to allow multiple downloads. Continue?',{ok:'Download all'}))return;
  stop=false; stopbtn.hidden=false; allbtn.disabled=true;
  const parts=Math.ceil(total/CH); let after=0, part=0, done=0;
  try{
    for(;!stop;){
      const rows=await fetchRows('limit='+CH+'&after='+after); if(!rows.length)break;
      part++; const z=new JSZip();
      for(let i=0;i<rows.length&&!stop;i++){
        st.textContent='ZIP '+part+' / '+parts+' — certificate '+(i+1)+' / '+rows.length+'  ('+(done+i).toLocaleString('en-US')+' of '+total.toLocaleString('en-US')+' done)';
        const c=await render(rows[i]); z.file(fname(rows[i]),pdfOf(c).output('arraybuffer'));
      }
      if(stop)break;
      st.textContent='Zipping part '+part+' / '+parts+'…';
      const blob=await z.generateAsync({type:'blob'}); const a=document.createElement('a');
      a.href=URL.createObjectURL(blob); a.download='certificates_ICSSST2027_part-'+pad(part)+'-of-'+pad(parts)+'.zip'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),60000);
      await issue(rows.map(r=>r.id)); done+=rows.length; after=rows[rows.length-1].id;
      await new Promise(r=>setTimeout(r,700));
    }
    st.textContent=stop?'Stopped after '+done.toLocaleString('en-US')+' certificates. To continue later, filter the dashboard by “Attended, no certificate yet”.':'Finished — '+done.toLocaleString('en-US')+' certificates downloaded.';
  }catch(e){st.textContent='Error: '+e.message}
  stopbtn.hidden=true; allbtn.disabled=false;
};
(async()=>{try{addItems(await fetchRows('limit='+PAGE+'&offset=0'));if(P.length)show(0)}catch(e){st.textContent=e.message}})();
}
