// Shared UI Components — pixel-perfect from design
// Exports: StarField, MiniPlayer, AuthModal, GlowButton, Chip, SectionHeader,
//          FuturisticCard, EventCard, MixCard, TicketCard, VideoModal, Spinner

const { useState, useEffect, useRef, useCallback } = React;

/* ─── Star Field ─────────────────────────────────────────────────── */
function StarField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const rng = (a, b) => Math.random() * (b - a) + a;
    const ri = (a, b) => (rng(a, b)) | 0;
    const starList = [];
    let attempts = 0;
    while (starList.length < 340 && attempts < 2000) {
      attempts++;
      const i = starList.length;
      const tier = i < 200 ? 0 : i < 290 ? 1 : i < 330 ? 2 : 3;
      const x = rng(0, W), y = rng(0, H);
      const dx = x - W * 0.87, dy = y - H * 0.17;
      if (Math.sqrt(dx * dx + dy * dy) < W * 0.09) continue;
      const r = [rng(0.15, 0.7), rng(0.7, 1.4), rng(1.4, 2.4), rng(2.4, 3.8)][tier];
      const cr = Math.random();
      const color = cr > 0.88 ? `rgba(${ri(160,240)},${ri(200,255)},255,`
        : cr > 0.76 ? `rgba(200,${ri(225,255)},${ri(235,255)},`
        : cr > 0.6 ? `rgba(255,${ri(230,255)},${ri(190,230)},`
        : `rgba(255,255,255,`;
      starList.push({ x, y, r, color, alpha: rng(0.1, 0.65), maxAlpha: rng(0.45, tier===3?0.9:0.75), minAlpha: rng(0.02, 0.1), twinkleSpeed: rng(0.003, 0.009), twinkleDir: Math.random()>0.5?1:-1, hasFlare: tier>=2&&Math.random()>0.35 });
    }
    const nebulae = [
      { x:W*0.08,y:H*0.18,rx:500,ry:260,color:'20,70,200',alpha:0.07 },
      { x:W*0.12,y:H*0.30,rx:320,ry:160,color:'10,120,220',alpha:0.05 },
      { x:W*0.80,y:H*0.50,rx:380,ry:280,color:'0,170,210',alpha:0.06 },
      { x:W*0.72,y:H*0.62,rx:200,ry:140,color:'0,200,180',alpha:0.04 },
      { x:W*0.48,y:H*0.06,rx:450,ry:130,color:'80,30,180',alpha:0.045 },
      { x:W*0.35,y:H*0.72,rx:280,ry:160,color:'30,60,160',alpha:0.035 },
    ];
    const saturn = { x:W*0.87,y:H*0.17,r:36 };
    const asteroids = Array.from({length:28},()=>({x:rng(W*0.55,W*0.98),y:rng(H*0.30,H*0.55),r:rng(0.6,1.8),alpha:rng(0.15,0.5)}));
    const galaxy = { x:W*0.22,y:H*0.68,angle:0 };
    let shooters = [], shooterTimer = 0;
    function spawnShooter() {
      const fast = Math.random()>0.6;
      shooters.push({x:rng(0,W*0.75),y:rng(0,H*0.45),vx:rng(fast?5:2.5,fast?9:5),vy:rng(fast?2:1,fast?4:2.5),tailLen:rng(60,fast?180:110),life:1,width:rng(0.8,fast?2.2:1.4)});
    }
    function drawFlare(x,y,r,a) {
      const len=r*5,alpha=a*0.35;
      [[len,0],[0,len],[len*0.5,len*0.5]].forEach(([dx,dy])=>{
        const g=ctx.createLinearGradient(x-dx,y-dy,x+dx,y+dy);
        g.addColorStop(0,`rgba(200,230,255,0)`);g.addColorStop(0.5,`rgba(220,240,255,${alpha})`);g.addColorStop(1,`rgba(200,230,255,0)`);
        ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);ctx.strokeStyle=g;ctx.lineWidth=0.8;ctx.stroke();
      });
    }
    function drawNebula(n) {
      const big=Math.max(n.rx,n.ry),g=ctx.createRadialGradient(0,0,0,0,0,big);
      g.addColorStop(0,`rgba(${n.color},${n.alpha})`);g.addColorStop(0.5,`rgba(${n.color},${n.alpha*0.4})`);g.addColorStop(1,`rgba(${n.color},0)`);
      ctx.save();ctx.translate(n.x,n.y);ctx.scale(n.rx/big,n.ry/big);ctx.beginPath();ctx.arc(0,0,big,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.restore();
    }
    function drawGalaxy(gx,gy,angle) {
      ctx.save();ctx.translate(gx,gy);ctx.rotate(angle);
      const core=ctx.createRadialGradient(0,0,0,0,0,22);core.addColorStop(0,'rgba(180,210,255,0.18)');core.addColorStop(0.4,'rgba(100,160,255,0.07)');core.addColorStop(1,'rgba(60,100,200,0)');
      ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fillStyle=core;ctx.fill();
      for(let arm=0;arm<2;arm++){ctx.save();ctx.rotate(arm*Math.PI);for(let s=0;s<60;s++){const t2=s/60,a2=t2*Math.PI*1.6,d=t2*55,px=Math.cos(a2)*d,py=Math.sin(a2)*d*0.45,sr=rng(0.3,1.0),sa=(1-t2)*0.22;ctx.beginPath();ctx.arc(px,py,sr,0,Math.PI*2);ctx.fillStyle=`rgba(${ri(140,210)},${ri(180,230)},255,${sa})`;ctx.fill();}ctx.restore();}
      ctx.restore();
    }
    function drawSaturn(p) {
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,0.28);
      for(let i=0;i<4;i++){const rr=p.r*(1.55+i*0.18),rw=p.r*0.1,rc=['rgba(120,180,240,0.22)','rgba(90,150,210,0.16)','rgba(140,200,255,0.12)','rgba(80,130,190,0.09)'][i];ctx.beginPath();ctx.arc(0,0,rr,Math.PI,Math.PI*2);ctx.strokeStyle=rc;ctx.lineWidth=rw*2.5/0.28;ctx.stroke();}
      ctx.restore();
      const g=ctx.createRadialGradient(p.x-p.r*0.35,p.y-p.r*0.35,p.r*0.05,p.x,p.y,p.r);
      g.addColorStop(0,'#2a6090');g.addColorStop(0.25,'#1a4a72');g.addColorStop(0.55,'#0d2e52');g.addColorStop(1,'#050e1e');
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.clip();
      [[-0.25,0.06,'rgba(30,90,150,0.25)'],[0.1,0.05,'rgba(20,70,120,0.2)'],[0.35,0.04,'rgba(40,100,160,0.15)']].forEach(([oy,ry2,c])=>{ctx.beginPath();ctx.ellipse(p.x,p.y+oy*p.r,p.r,p.r*ry2,0,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();});
      ctx.restore();
      const atm=ctx.createRadialGradient(p.x,p.y,p.r*0.85,p.x,p.y,p.r*1.6);atm.addColorStop(0,'rgba(60,150,230,0.18)');atm.addColorStop(0.5,'rgba(30,100,200,0.07)');atm.addColorStop(1,'rgba(20,60,180,0)');
      ctx.beginPath();ctx.arc(p.x,p.y,p.r*1.6,0,Math.PI*2);ctx.fillStyle=atm;ctx.fill();
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,0.28);
      for(let i=0;i<4;i++){const rr=p.r*(1.55+i*0.18),rw=p.r*0.1,rc=['rgba(120,180,240,0.22)','rgba(90,150,210,0.16)','rgba(140,200,255,0.12)','rgba(80,130,190,0.09)'][i];ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI);ctx.strokeStyle=rc;ctx.lineWidth=rw*2.5/0.28;ctx.stroke();}
      ctx.restore();
    }
    let raf;
    function draw() {
      ctx.clearRect(0,0,W,H);
      galaxy.angle+=0.0003;
      nebulae.forEach(drawNebula);
      drawGalaxy(galaxy.x,galaxy.y,galaxy.angle);
      asteroids.forEach(a=>{ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);ctx.fillStyle=`rgba(140,170,200,${a.alpha})`;ctx.fill();});
      drawSaturn(saturn);
      starList.forEach(s=>{
        s.alpha+=s.twinkleSpeed*s.twinkleDir;
        if(s.alpha>=s.maxAlpha||s.alpha<=s.minAlpha)s.twinkleDir*=-1;
        if(s.r>1.5){const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*3.5);g.addColorStop(0,s.color+s.alpha*0.9+')');g.addColorStop(1,s.color+'0)');ctx.beginPath();ctx.arc(s.x,s.y,s.r*3.5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}
        ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle=s.color+s.alpha+')';ctx.fill();
        if(s.hasFlare&&s.r>1.8)drawFlare(s.x,s.y,s.r,s.alpha);
      });
      shooterTimer++;
      if(shooterTimer>180+(Math.random()*280|0)){spawnShooter();shooterTimer=0;}
      shooters=shooters.filter(s=>s.life>0);
      shooters.forEach(s=>{
        s.life-=0.025;s.x+=s.vx;s.y+=s.vy;
        const tail=s.tailLen*s.life,hyp=Math.hypot(s.vx,s.vy);
        const sg=ctx.createLinearGradient(s.x,s.y,s.x-(s.vx/hyp)*tail,s.y-(s.vy/hyp)*tail);
        sg.addColorStop(0,`rgba(255,255,255,${s.life*0.95})`);sg.addColorStop(0.15,`rgba(180,225,255,${s.life*0.7})`);sg.addColorStop(0.5,`rgba(100,180,255,${s.life*0.25})`);sg.addColorStop(1,'rgba(60,140,255,0)');
        const nx=-s.vy/hyp,ny=s.vx/hyp,ex=s.x-(s.vx/hyp)*tail,ey=s.y-(s.vy/hyp)*tail;
        ctx.beginPath();ctx.moveTo(s.x+nx*s.width,s.y+ny*s.width);ctx.lineTo(s.x-nx*s.width,s.y-ny*s.width);ctx.lineTo(ex,ey);ctx.closePath();ctx.fillStyle=sg;ctx.fill();
        const hg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.width*4);hg.addColorStop(0,`rgba(255,255,255,${s.life*0.9})`);hg.addColorStop(1,'rgba(150,210,255,0)');
        ctx.beginPath();ctx.arc(s.x,s.y,s.width*4,0,Math.PI*2);ctx.fillStyle=hg;ctx.fill();
      });
      raf=requestAnimationFrame(draw);
    }
    draw();
    const onResize=()=>{W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;saturn.x=W*0.87;saturn.y=H*0.17;galaxy.x=W*0.22;galaxy.y=H*0.68;nebulae[0].x=W*0.08;nebulae[1].x=W*0.12;nebulae[2].x=W*0.80;nebulae[3].x=W*0.72;nebulae[4].x=W*0.48;nebulae[5].x=W*0.35;};
    window.addEventListener('resize',onResize);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',onResize);};
  },[]);
  return React.createElement('canvas',{ref:canvasRef,style:{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}});
}

/* ─── Futuristic Card ────────────────────────────────────────────── */
function FuturisticCard({ children, active=false, onClick, style={} }) {
  const [hovered, setHovered] = useState(false);
  const hot = hovered || active;
  const bc = active ? 'rgba(50,114,168,0.9)' : hot ? 'rgba(50,114,168,0.6)' : 'rgba(50,114,168,0.25)';
  const brkt = active ? '#3272a8' : hot ? '#5a92c0' : 'rgba(50,114,168,0.5)';
  return React.createElement('div', { onMouseEnter:()=>setHovered(true), onMouseLeave:()=>setHovered(false), onClick, style:{ position:'relative', cursor:onClick?'pointer':'default', transition:'transform 0.2s,box-shadow 0.2s', transform:hot&&onClick?'translateY(-2px)':'none', boxShadow:active?'0 0 24px rgba(50,114,168,0.35),inset 0 0 30px rgba(50,114,168,0.06)':hot?'0 0 16px rgba(50,114,168,0.2)':'none', ...style }},
    React.createElement('div', { style:{ position:'relative', background:hot?'rgba(5,18,44,0.93)':'rgba(3,11,28,0.88)', border:'1px solid '+bc, backdropFilter:'blur(14px)', padding:'22px 24px', transition:'background 0.2s,border-color 0.2s' }},
      React.createElement('div', { style:{ position:'absolute',inset:0,zIndex:0,pointerEvents:'none', backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(50,114,168,0.018) 3px,rgba(50,114,168,0.018) 4px)', opacity:hot?1:0.5,transition:'opacity 0.2s' }}),
      React.createElement('div', { style:{ position:'absolute',top:0,left:0,right:0,height:1,zIndex:2, background:active?'linear-gradient(90deg,#3272a8,rgba(50,114,168,0.3),transparent)':hot?'linear-gradient(90deg,rgba(50,114,168,0.8),rgba(50,114,168,0.2),transparent)':'linear-gradient(90deg,rgba(50,114,168,0.4),transparent)', transition:'background 0.2s' }}),
      React.createElement('div', { style:{ position:'absolute',bottom:0,left:0,right:0,height:1,zIndex:2, background:'linear-gradient(90deg,transparent,rgba(50,114,168,0.15),transparent)' }}),
      React.createElement('div', { style:{ position:'absolute',top:6,left:6,zIndex:3,width:12,height:12, borderTop:'1.5px solid '+brkt,borderLeft:'1.5px solid '+brkt, transition:'border-color 0.2s' }}),
      React.createElement('div', { style:{ position:'absolute',top:6,right:6,zIndex:3,width:12,height:12, borderTop:'1.5px solid '+brkt,borderRight:'1.5px solid '+brkt, transition:'border-color 0.2s' }}),
      React.createElement('div', { style:{ position:'absolute',bottom:6,left:6,zIndex:3,width:12,height:12, borderBottom:'1.5px solid '+brkt,borderLeft:'1.5px solid '+brkt, transition:'border-color 0.2s' }}),
      React.createElement('div', { style:{ position:'absolute',bottom:6,right:6,zIndex:3,width:12,height:12, borderBottom:'1.5px solid '+brkt,borderRight:'1.5px solid '+brkt, transition:'border-color 0.2s' }}),
      React.createElement('div', { style:{ position:'relative',zIndex:1 }}, children)
    )
  );
}

/* ─── Glow Button ────────────────────────────────────────────────── */
function GlowButton({ children, onClick, variant='primary', small=false, style={}, disabled=false, type='button' }) {
  const base = { display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8, padding:small?'8px 18px':'12px 28px', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,letterSpacing:'0.08em', fontSize:small?12:14, textTransform:'uppercase', border:'none',borderRadius:0,cursor:disabled?'not-allowed':'pointer', transition:'all 0.2s', opacity:disabled?0.5:1, ...style };
  if (variant==='primary') return React.createElement('button',{type,onClick,disabled,style:{...base,background:'linear-gradient(135deg,#3272a8,#9f84b2,#3272a8)',backgroundSize:'200% 200%',animation:'btnGlow 3s ease infinite',color:'#fff',boxShadow:'0 0 20px rgba(50,114,168,0.5),0 0 40px rgba(159,132,178,0.2)'}},children);
  if (variant==='ghost') return React.createElement('button',{type,onClick,disabled,style:{...base,background:'transparent',color:'#fff',border:'1px solid rgba(255,255,255,0.2)'}},children);
  if (variant==='pink') return React.createElement('button',{type,onClick,disabled,style:{...base,background:'linear-gradient(135deg,#9f84b2,#3272a8)',backgroundSize:'200% 200%',animation:'btnGlow 3s ease infinite reverse',color:'#fff',boxShadow:'0 0 18px rgba(159,132,178,0.5)'}},children);
  if (variant==='danger') return React.createElement('button',{type,onClick,disabled,style:{...base,background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}},children);
}

/* ─── Chip ───────────────────────────────────────────────────────── */
function Chip({ label, color='#3272a8' }) {
  return React.createElement('span',{style:{display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',background:color+'22',color,border:`1px solid ${color}55`,fontFamily:"'Space Grotesk',sans-serif"}},label);
}

/* ─── Section Header ─────────────────────────────────────────────── */
function SectionHeader({ title, subtitle }) {
  return React.createElement('div',{style:{marginBottom:40}},
    React.createElement('h2',{style:{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:'clamp(28px,4vw,48px)',letterSpacing:'-0.02em',color:'#fff',margin:0,textTransform:'uppercase'}},title),
    subtitle&&React.createElement('p',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:16,marginTop:8}},subtitle)
  );
}

/* ─── Spinner ────────────────────────────────────────────────────── */
function Spinner() {
  return React.createElement('div',{style:{display:'flex',justifyContent:'center',padding:'60px 0'}},
    React.createElement('div',{style:{width:32,height:32,border:'2px solid rgba(50,114,168,0.3)',borderTop:'2px solid #3272a8',borderRadius:'50%',animation:'spin 0.8s linear infinite'}})
  );
}

/* ─── Event Card ─────────────────────────────────────────────────── */
function EventCard({ event, onSelect, onRegister }) {
  return React.createElement(FuturisticCard,{onClick:()=>onSelect(event)},
    event.posterImage&&React.createElement('img',{src:event.posterImage,alt:event.title,style:{width:'100%',borderRadius:4,objectFit:'cover',maxHeight:180,marginBottom:14}}),
    React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}},
      React.createElement(Chip,{label:event.status==='upcoming'?'Upcoming':'Past',color:event.status==='upcoming'?'#3272a8':'#64748b'}),
      event.isFree&&React.createElement(Chip,{label:'FREE',color:'#10b981'}),
      event.featured&&React.createElement(Chip,{label:'Featured',color:'#f59e0b'})
    ),
    React.createElement('h3',{style:{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:20,color:'#fff',margin:'0 0 8px',letterSpacing:'-0.01em',textTransform:'uppercase'}},event.title),
    React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:3,marginBottom:10}},
      React.createElement('span',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'#6ba3d4',fontSize:13,fontWeight:600}},event.displayDate+' · '+event.startTime),
      React.createElement('span',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.45)',fontSize:12}},event.venue+', '+event.location)
    ),
    React.createElement('p',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.55)',fontSize:13,margin:'0 0 14px',lineHeight:1.6}},
      (event.description||'').substr(0,110)+(event.description&&event.description.length>110?'…':'')),
    React.createElement('div',{style:{display:'flex',gap:10}},
      React.createElement(GlowButton,{onClick:e=>{e.stopPropagation();onSelect(event);},small:true,variant:'ghost'},'View Event'),
      event.status==='upcoming'&&React.createElement(GlowButton,{onClick:e=>{e.stopPropagation();onRegister(event);},small:true,variant:'primary'},event.isFree?'Get Free Ticket':'Buy Ticket')
    )
  );
}

/* ─── Mix Card ───────────────────────────────────────────────────── */
function MixCard({ mix, onPlay, isPlaying }) {
  return React.createElement(FuturisticCard,{active:isPlaying,onClick:()=>onPlay(mix)},
    mix.coverImage&&React.createElement('img',{src:mix.coverImage,alt:mix.title,style:{width:'100%',height:140,objectFit:'cover',marginBottom:14}}),
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}},
      React.createElement('div',{style:{width:52,height:52,flexShrink:0,clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))',background:isPlaying?'#3272a8':'rgba(50,114,168,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:isPlaying?'0 0 20px rgba(6,182,212,0.6)':'none',color:'#fff',transition:'all 0.2s'}},isPlaying?'⏸':'▶'),
      React.createElement('div',{style:{textAlign:'right'}},
        React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,fontWeight:700,letterSpacing:'0.12em',color:'rgba(255,255,255,0.35)',textTransform:'uppercase'}},mix.duration),
        React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,color:'rgba(255,255,255,0.25)',marginTop:2}},mix.month)
      )
    ),
    React.createElement('h3',{style:{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:17,color:'#fff',margin:'0 0 3px',textTransform:'uppercase',letterSpacing:'-0.01em'}},mix.title),
    React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'#6ba3d4',fontSize:12,fontWeight:600,marginBottom:10,letterSpacing:'0.06em'}},mix.residentName),
    React.createElement('p',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:13,margin:'0 0 14px',lineHeight:1.6}},mix.description),
    React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
      React.createElement(GlowButton,{small:true,variant:isPlaying?'pink':'primary',onClick:e=>{e.stopPropagation();onPlay(mix);}},
        isPlaying?'Now Playing':'Play Mix'),
      mix.hasVideo&&!isPlaying&&React.createElement(GlowButton,{small:true,variant:'ghost',onClick:e=>{e.stopPropagation();onPlay(mix);}},
        '▶ Watch')
    )
  );
}

/* ─── Ticket Card ────────────────────────────────────────────────── */
function TicketCard({ ticket }) {
  const event = ticket.event || {};
  return React.createElement(FuturisticCard,{active:ticket.status==='valid'},
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}},
      React.createElement('div',null,
        React.createElement(Chip,{label:ticket.status==='valid'?'Valid':ticket.status==='used'?'Used':'Cancelled',color:ticket.status==='valid'?'#10b981':'#64748b'}),
        React.createElement('h3',{style:{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:20,color:'#fff',margin:'8px 0 4px',textTransform:'uppercase'}},event.title||'Event Ticket'),
        React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'#3272a8',fontSize:13,fontWeight:600}},ticket.ticketTypeName||'General Entry')
      ),
      React.createElement('div',{style:{width:60,height:60,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:4,fontSize:8,fontFamily:'monospace',color:'#000',textAlign:'center',wordBreak:'break-all',padding:4}},ticket.qrCode)
    ),
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
      [['HOLDER',ticket.holderName],['REF',ticket.id],['DATE',event.displayDate||'—'],['VENUE',event.venue||'—']].map(([label,val])=>
        React.createElement('div',{key:label},
          React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:10,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:2}},label),
          React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'#fff',fontSize:13,fontWeight:600}},val)
        )
      )
    )
  );
}

/* ─── Auth Modal ─────────────────────────────────────────────────── */
function AuthModal({ mode, onClose, onSuccess }) {
  const [tab, setTab] = useState(mode||'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (tab === 'login') {
        res = await window.RNTECH_API.login(email, password);
      } else {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return; }
        res = await window.RNTECH_API.register(name, email, password);
      }
      window.RNTECH_AUTH.setToken(res.token);
      window.RNTECH_AUTH.setUser(res.user);
      onSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width:'100%',padding:'12px 16px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:0,color:'#fff',fontSize:15,fontFamily:"'Space Grotesk',sans-serif",outline:'none',boxSizing:'border-box' };

  return React.createElement('div',{style:{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20},onClick:onClose},
    React.createElement('div',{onClick:e=>e.stopPropagation(),style:{background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',borderRadius:0,padding:40,width:'100%',maxWidth:420,boxShadow:'0 0 60px rgba(50,114,168,0.2)'}},
      React.createElement('h2',{style:{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:28,color:'#fff',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'-0.02em'}},tab==='login'?'Sign In':'Create Account'),
      React.createElement('p',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:14,marginBottom:28}},tab==='login'?'Welcome back to RNTECH.':'Join RNTECH. Get tickets and mixes all in one place.'),
      React.createElement('form',{onSubmit:submit,style:{display:'flex',flexDirection:'column',gap:14}},
        tab==='register'&&React.createElement('input',{placeholder:'Your Name',value:name,onChange:e=>setName(e.target.value),required:true,style:inputStyle}),
        React.createElement('input',{type:'email',placeholder:'Email Address',value:email,onChange:e=>setEmail(e.target.value),required:true,style:inputStyle}),
        React.createElement('input',{type:'password',placeholder:'Password',value:password,onChange:e=>setPassword(e.target.value),required:true,minLength:6,style:inputStyle}),
        error&&React.createElement('div',{style:{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:4,padding:'10px 14px',fontFamily:"'Space Grotesk',sans-serif",color:'#ef4444',fontSize:13}},error),
        React.createElement('button',{type:'submit',disabled:loading,style:{padding:14,borderRadius:0,border:'none',cursor:loading?'wait':'pointer',background:'linear-gradient(135deg,#3272a8 0%,#06b6d4 100%)',color:'#fff',fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:14,letterSpacing:'0.08em',textTransform:'uppercase',boxShadow:'0 0 20px rgba(50,114,168,0.4)',opacity:loading?0.7:1}},loading?'Please wait…':tab==='login'?'Sign In':'Create Account'),
        React.createElement('button',{type:'button',onClick:()=>{setTab(tab==='login'?'register':'login');setError('');},style:{background:'none',border:'none',cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:13}},tab==='login'?'No account? Create one →':'← Already have an account? Sign in')
      )
    )
  );
}

/* ─── Video Modal ────────────────────────────────────────────────── */
function VideoModal({ mix, videoRef, onClose }) {
  if (!mix || !mix.videoSrc) return null;
  return React.createElement('div',{
    style:{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.92)',backdropFilter:'blur(16px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20},
    onClick:onClose
  },
    React.createElement('div',{onClick:e=>e.stopPropagation(),style:{width:'100%',maxWidth:900,position:'relative'}},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}},
        React.createElement('div',null,
          React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:18,color:'#fff',textTransform:'uppercase'}},mix.title),
          React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'#3272a8',fontSize:13}},mix.residentName)
        ),
        React.createElement('button',{onClick:onClose,style:{background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'#fff',cursor:'pointer',padding:'8px 16px',fontFamily:"'Space Grotesk',sans-serif",fontSize:12,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase'}},'✕ CLOSE')
      ),
      // Move the persistent video element here when modal is open
      React.createElement('div',{id:'video-modal-slot',style:{width:'100%',background:'#000',aspectRatio:'16/9',position:'relative'}},
        React.createElement('p',{style:{color:'rgba(255,255,255,0.3)',fontFamily:"'Space Grotesk',sans-serif",fontSize:13,textAlign:'center',paddingTop:40}},
          'Video loading…')
      ),
      mix.tracklist&&mix.tracklist.length>0&&React.createElement('div',{style:{marginTop:16}},
        React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.3)',fontSize:11,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}},'Tracklist'),
        mix.tracklist.map((t,i)=>React.createElement('div',{key:i,style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.6)',fontSize:13,padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}},t))
      )
    )
  );
}

/* ─── Mini Player ────────────────────────────────────────────────── */
function MiniPlayer({ mix, videoRef, onClose, onWatch }) {
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bars] = useState(()=>Array.from({length:20},()=>Math.random()*0.6+0.2));

  // Sync with actual video element
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => {
      if (vid.duration) setProgress((vid.currentTime / vid.duration) * 100);
    };
    const onDur = () => setDuration(vid.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('durationchange', onDur);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('durationchange', onDur);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
    };
  }, [videoRef, mix]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play();
    else vid.pause();
  };

  const seek = (e) => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    vid.currentTime = pct * vid.duration;
  };

  return React.createElement('div',{style:{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',zIndex:200,width:'min(520px,calc(100vw - 40px))',background:'rgba(10,5,20,0.95)',border:'1px solid rgba(6,182,212,0.4)',borderRadius:6,padding:'14px 20px',backdropFilter:'blur(20px)',boxShadow:'0 0 40px rgba(50,114,168,0.25)',display:'flex',alignItems:'center',gap:14}},
    // Album art / icon
    mix.coverImage
      ? React.createElement('img',{src:mix.coverImage,alt:'',style:{width:44,height:44,borderRadius:4,objectFit:'cover',flexShrink:0,boxShadow:'0 0 14px rgba(6,182,212,0.4)'}})
      : React.createElement('div',{style:{width:44,height:44,borderRadius:4,flexShrink:0,background:'linear-gradient(135deg,#06b6d4,#3272a8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,boxShadow:'0 0 14px rgba(6,182,212,0.4)'}},'♪'),
    // Info + progress
    React.createElement('div',{style:{flex:1,minWidth:0}},
      React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:13,color:'#fff',textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},mix.title),
      React.createElement('div',{style:{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,color:'#3272a8',marginBottom:6}},mix.residentName),
      // Animated bars
      React.createElement('div',{style:{display:'flex',alignItems:'flex-end',gap:2,height:20,marginBottom:4}},
        bars.map((h,i)=>React.createElement('div',{key:i,style:{width:3,borderRadius:2,flexShrink:0,background:'#3272a8',height:playing?`${h*20}px`:'4px',opacity:playing?0.4+h*0.6:0.2,transition:'height 0.3s ease'}}))
      ),
      // Scrubber
      React.createElement('div',{onClick:seek,style:{height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden',cursor:'pointer'}},
        React.createElement('div',{style:{height:'100%',width:progress+'%',background:'#3272a8',transition:'width 0.1s linear'}})
      )
    ),
    // Watch button (if has video)
    mix.hasVideo&&React.createElement('button',{onClick:onWatch,style:{background:'none',border:'1px solid rgba(50,114,168,0.4)',color:'#3272a8',cursor:'pointer',padding:'6px 10px',fontSize:11,fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap',flexShrink:0}},'▶ WATCH'),
    // Play/pause
    React.createElement('button',{onClick:togglePlay,style:{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},playing?'⏸':'▶'),
    // Close
    React.createElement('button',{onClick:onClose,style:{width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},'×')
  );
}

Object.assign(window, {
  StarField, GlowButton, Chip, SectionHeader, FuturisticCard, Spinner,
  EventCard, MixCard, TicketCard, AuthModal, MiniPlayer, VideoModal,
});
