// Public pages: Home, Events, EventDetail, Mixes, Tickets, Contact
const { useState, useEffect } = React;

/* ─── HOME ─────────────────────────────────────────────────────────── */
function PageHome({ user, onAuth, onNavigate, onPlayMix, currentMix }) {
  const [events, setEvents] = useState([]);
  const [mixes, setMixes] = useState([]);
  const [sponsors, setSponsors] = useState([]);

  useEffect(() => {
    Promise.all([
      window.RNTECH_API.getEvents(),
      window.RNTECH_API.getMixes(),
      window.RNTECH_API.getSponsors(),
    ]).then(([ev, mx, sp]) => {
      setEvents(ev);
      setMixes(mx);
      setSponsors(sp);
    }).catch(()=>{});
  }, []);

  const featured = events.find(e => e.featured);

  return React.createElement('div', null,
    // Hero
    React.createElement('section', { style:{ minHeight:'92vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'120px 24px 80px',textAlign:'center',position:'relative' } },
      React.createElement('div', { style:{ position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none' } },
        React.createElement('div', { style:{ position:'absolute',top:'10%',left:'50%',transform:'translateX(-50%)',width:600,height:600,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(50,114,168,0.15) 0%,transparent 70%)',filter:'blur(40px)' } }),
        React.createElement('div', { style:{ position:'absolute',top:'30%',left:'20%',width:300,height:300,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(6,182,212,0.1) 0%,transparent 70%)',filter:'blur(40px)' } })
      ),
      React.createElement('img', { src:'/static/uploads/logo-transparent.png',alt:'RNTECH',style:{ width:'min(280px,60vw)',marginBottom:32,filter:'brightness(0) invert(1) drop-shadow(0 0 30px rgba(50,114,168,0.8)) drop-shadow(0 0 60px rgba(6,182,212,0.4))',animation:'logoGlow 3s ease-in-out infinite alternate' } }),
      React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:'clamp(14px,2vw,18px)',letterSpacing:'0.3em',textTransform:'uppercase',marginBottom:48,maxWidth:500 } },'RnB Meets Tech House · St Albans'),
      featured&&React.createElement(FuturisticCard, { active:true, style:{ maxWidth:560,marginBottom:40,textAlign:'center' } },
        React.createElement(Chip, { label:'Next Event', color:'#10b981' }),
        React.createElement('h2', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:'clamp(22px,4vw,36px)',color:'#fff',margin:'12px 0 8px',textTransform:'uppercase',letterSpacing:'-0.02em' } }, featured.title),
        React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'#3272a8',fontWeight:600,marginBottom:4 } }, featured.displayDate+' · '+featured.startTime),
        React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:14,marginBottom:24 } }, featured.venue+', '+featured.location),
        React.createElement('div', { style:{ display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap' } },
          React.createElement(GlowButton, { onClick:()=>onNavigate('events'), variant:'primary' }, 'Get Tickets'),
          React.createElement(GlowButton, { onClick:()=>onNavigate('events'), variant:'ghost' }, 'View Lineup')
        )
      ),
      !user&&React.createElement('button', { onClick:()=>onAuth('register'), style:{ background:'none',border:'none',cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:14,textDecoration:'underline' } },'Create an account to save your tickets →')
    ),

    // Lineup
    featured&&React.createElement('section', { style:{ padding:'60px 24px',maxWidth:900,margin:'0 auto' } },
      React.createElement(SectionHeader, { title:'Lineup', subtitle:featured.title+' · '+featured.displayDate }),
      React.createElement('div', { style:{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:16 } },
        featured.lineup.map(dj=>React.createElement(FuturisticCard, { key:dj.name,active:dj.role==='Headliner',style:{ textAlign:'center' } },
          React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:14,color:'#fff',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8 } }, dj.name),
          React.createElement(Chip, { label:dj.role, color:dj.role==='Headliner'?'#3272a8':'#64748b' })
        ))
      )
    ),

    // Sponsors
    sponsors.length>0&&React.createElement('section', { style:{ padding:'40px 24px 80px',maxWidth:900,margin:'0 auto',textAlign:'center' } },
      React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.3)',fontSize:12,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:24 } },'Supported by'),
      React.createElement('div', { style:{ display:'flex',gap:32,justifyContent:'center',flexWrap:'wrap' } },
        sponsors.map(s=>React.createElement('div', { key:s.id,style:{ display:'flex',flexDirection:'column',alignItems:'center',gap:8 } },
          s.logo&&React.createElement('img', { src:s.logo,alt:s.name,style:{ height:64,width:64,objectFit:'contain',filter:'brightness(1.1) contrast(1.1)' } }),
          React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:14,color:'rgba(255,255,255,0.6)',letterSpacing:'0.08em',textTransform:'uppercase',textAlign:'center' } }, s.name),
          React.createElement('div', { style:{ fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:400,letterSpacing:'0.06em' } }, s.subtitle)
        ))
      )
    )
  );
}

/* ─── EVENTS ─────────────────────────────────────────────────────── */
function PageEvents({ user, onAuth, onPlayMix }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [ticketEvent, setTicketEvent] = useState(null);
  const [ticketSuccess, setTicketSuccess] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [holderName, setHolderName] = useState(user?user.name:'');
  const [holderEmail, setHolderEmail] = useState(user?user.email:'');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    window.RNTECH_API.getEvents().then(ev => { setEvents(ev); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  const handleRegister = (event) => {
    if (!user) { alert('Please sign in to get tickets.'); return; }
    const types = (event.ticketTypes||[]).filter(t=>t.active);
    setSelectedType(types[0]||null);
    setTicketEvent(event);
    setHolderName(user.name);
    setHolderEmail(user.email);
    setBuyError('');
  };

  const doTicket = async () => {
    if (!selectedType) return;
    setBuying(true);
    setBuyError('');
    try {
      const ticket = await window.RNTECH_API.issueTicket({
        ticketTypeId: selectedType.id,
        holderName, holderEmail,
      });
      setTicketSuccess(ticket);
      setTicketEvent(null);
    } catch(err) {
      setBuyError(err.message||'Failed to issue ticket');
    } finally {
      setBuying(false);
    }
  };

  if (loading) return React.createElement('div',{style:{padding:'120px 24px'}},React.createElement(Spinner));
  const upcoming = events.filter(e=>e.status==='upcoming');
  const past = events.filter(e=>e.status==='past');

  if (selected) return React.createElement(EventDetail, { event:selected,user,onBack:()=>setSelected(null),onRegister:handleRegister });

  const inputStyle = { width:'100%',padding:'12px 16px',marginBottom:12,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:0,color:'#fff',fontSize:14,fontFamily:"'Space Grotesk',sans-serif",outline:'none',boxSizing:'border-box' };

  return React.createElement('div', { style:{ padding:'100px 24px 100px',maxWidth:900,margin:'0 auto' } },
    React.createElement(SectionHeader, { title:'Events', subtitle:'All RNTECH events — past and upcoming.' }),
    ticketSuccess&&React.createElement('div', { style:{ background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:0,padding:20,marginBottom:32,fontFamily:"'Space Grotesk',sans-serif",color:'#10b981' } },
      '✓ Ticket confirmed! Ref: '+ticketSuccess.id,
      React.createElement('button', { onClick:()=>setTicketSuccess(null), style:{ background:'none',border:'none',color:'#10b981',cursor:'pointer',marginLeft:12 } },'×')
    ),
    upcoming.length>0&&React.createElement('div', { style:{ marginBottom:48 } },
      React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:12,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:20 } },'Upcoming'),
      React.createElement('div', { style:{ display:'grid',gap:20,gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))' } },
        upcoming.map(e=>React.createElement(EventCard, { key:e.id,event:e,onSelect:setSelected,onRegister:handleRegister }))
      )
    ),
    past.length>0&&React.createElement('div', null,
      React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:12,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:20 } },'Past Events'),
      React.createElement('div', { style:{ display:'grid',gap:20,gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))' } },
        past.map(e=>React.createElement(EventCard, { key:e.id,event:e,onSelect:setSelected,onRegister:handleRegister }))
      )
    ),
    // Ticket modal
    ticketEvent&&React.createElement('div', { style:{ position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }, onClick:()=>setTicketEvent(null) },
      React.createElement('div', { onClick:e=>e.stopPropagation(), style:{ background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',borderRadius:0,padding:36,width:'100%',maxWidth:440,boxShadow:'0 0 60px rgba(50,114,168,0.2)' } },
        React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:22,color:'#fff',margin:'0 0 6px',textTransform:'uppercase' } },'Get Tickets'),
        React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:20 } }, ticketEvent.title+' · '+ticketEvent.displayDate),
        React.createElement('div', { style:{ display:'flex',flexDirection:'column',gap:12,marginBottom:24 } },
          (ticketEvent.ticketTypes||[]).filter(t=>t.active).map(t=>
            React.createElement('div', { key:t.id, onClick:()=>setSelectedType(t), style:{ background:selectedType&&selectedType.id===t.id?'rgba(50,114,168,0.15)':'rgba(255,255,255,0.03)',border:`1px solid ${selectedType&&selectedType.id===t.id?'rgba(50,114,168,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:0,padding:'16px 18px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center' } },
              React.createElement('div', null,
                React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:15,color:'#fff' } }, t.name),
                React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:12,marginTop:3 } }, t.description)
              ),
              React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:18,color:t.price===0?'#10b981':'#fff' } }, t.price===0?'FREE':'£'+(t.price/100).toFixed(2))
            )
          )
        ),
        React.createElement('input', { placeholder:'Your Name',value:holderName,onChange:e=>setHolderName(e.target.value),style:inputStyle }),
        React.createElement('input', { type:'email',placeholder:'Your Email',value:holderEmail,onChange:e=>setHolderEmail(e.target.value),style:inputStyle }),
        buyError&&React.createElement('div', { style:{ color:'#ef4444',fontSize:13,marginBottom:12,fontFamily:"'Space Grotesk',sans-serif" } }, buyError),
        React.createElement(GlowButton, { onClick:doTicket,style:{ width:'100%',marginTop:4 },disabled:buying },
          buying?'Processing…':selectedType&&selectedType.price===0?'Confirm Free Ticket':'Confirm Purchase')
      )
    )
  );
}

/* ─── EVENT DETAIL ─────────────────────────────────────────────── */
function EventDetail({ event, user, onBack, onRegister }) {
  return React.createElement('div', { style:{ padding:'100px 24px 100px',maxWidth:800,margin:'0 auto' } },
    React.createElement('button', { onClick:onBack, style:{ background:'none',border:'none',cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:14,marginBottom:32,display:'flex',alignItems:'center',gap:8 } },'← Back to Events'),
    event.posterImage&&React.createElement('img', { src:event.posterImage,alt:event.title,style:{ width:'100%',borderRadius:0,objectFit:'cover',maxHeight:400,marginBottom:32 } }),
    React.createElement('div', { style:{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:16 } },
      React.createElement(Chip, { label:event.status==='upcoming'?'Upcoming':'Past', color:event.status==='upcoming'?'#3272a8':'#64748b' }),
      event.isFree&&React.createElement(Chip, { label:'FREE ENTRY', color:'#10b981' })
    ),
    React.createElement('h1', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:'clamp(28px,5vw,52px)',color:'#fff',margin:'0 0 12px',textTransform:'uppercase',letterSpacing:'-0.02em' } }, event.title),
    React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'#3272a8',fontSize:18,fontWeight:600,marginBottom:4 } }, event.displayDate+' · '+event.startTime+(event.endTime?' – '+event.endTime:'')),
    React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',marginBottom:32 } }, event.venue+', '+event.location),
    React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.7)',fontSize:16,lineHeight:1.8,marginBottom:40 } }, event.description),
    event.lineup&&event.lineup.length>0&&React.createElement('div', null,
      React.createElement('h2', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:22,color:'#fff',textTransform:'uppercase',marginBottom:20 } },'Lineup'),
      React.createElement('div', { style:{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:40 } },
        event.lineup.map(dj=>React.createElement(FuturisticCard, { key:dj.name,active:dj.role==='Headliner',style:{ textAlign:'center' } },
          React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:14,color:'#fff',textTransform:'uppercase',marginBottom:8 } }, dj.name),
          React.createElement(Chip, { label:dj.role, color:dj.role==='Headliner'?'#06b6d4':'#64748b' })
        ))
      )
    ),
    event.giveaways&&event.giveaways.length>0&&React.createElement('div', { style:{ marginBottom:40 } },
      React.createElement('h2', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:22,color:'#fff',textTransform:'uppercase',marginBottom:16 } },'On The Night'),
      event.giveaways.map((g,i)=>React.createElement('div', { key:i, style:{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.7)',fontSize:14 } },
        React.createElement('span', { style:{ color:'#10b981',fontSize:16 } },'✓'), g
      ))
    ),
    event.status==='upcoming'&&React.createElement(GlowButton, { onClick:()=>onRegister(event) }, event.isFree?'Get Free Ticket':'Buy Ticket')
  );
}

/* ─── MIXES ──────────────────────────────────────────────────────── */
function PageMixes({ user, currentMix, onPlayMix }) {
  const [mixes, setMixes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.RNTECH_API.getMixes().then(mx => { setMixes(mx); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  if (loading) return React.createElement('div',{style:{padding:'120px 24px'}},React.createElement(Spinner));

  return React.createElement('div', { style:{ padding:'100px 24px 120px',maxWidth:900,margin:'0 auto' } },
    React.createElement(SectionHeader, { title:'Mixes', subtitle:'Resident and guest sets from RNTECH events.' }),
    mixes.length===0&&React.createElement('p',{style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)'}}, 'No mixes yet — check back soon.'),
    React.createElement('div', { style:{ display:'grid',gap:20,gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))' } },
      mixes.map(mix=>React.createElement(MixCard, { key:mix.id,mix,onPlay:onPlayMix,isPlaying:currentMix&&currentMix.id===mix.id }))
    ),
    React.createElement('div', { style:{ marginTop:60,textAlign:'center' } },
      React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.3)',fontSize:32,marginBottom:16 } },'♪'),
      React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:18,color:'#fff',margin:'0 0 8px' } },'More mixes dropping soon'),
      React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:14,margin:0 } },'Follow us to stay updated on new releases and live recordings.')
    )
  );
}

/* ─── TICKETS ────────────────────────────────────────────────────── */
function PageTickets({ user, onAuth }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    window.RNTECH_API.myTickets().then(t=>{ setTickets(t); setLoading(false); }).catch(()=>setLoading(false));
  }, [user]);

  if (!user) return React.createElement('div', { style:{ padding:'100px 24px',maxWidth:600,margin:'0 auto',textAlign:'center' } },
    React.createElement('div', { style:{ fontSize:48,marginBottom:20 } },'🎫'),
    React.createElement('h2', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:28,color:'#fff',textTransform:'uppercase',marginBottom:12 } },'Your Tickets'),
    React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',marginBottom:28 } },'Sign in to view your tickets and QR codes.'),
    React.createElement(GlowButton, { onClick:()=>onAuth('login') },'Sign In'),
    React.createElement('span', { style:{ display:'inline-block',width:12 } }),
    React.createElement(GlowButton, { onClick:()=>onAuth('register'),variant:'ghost' },'Create Account')
  );

  if (loading) return React.createElement('div',{style:{padding:'120px 24px'}},React.createElement(Spinner));

  return React.createElement('div', { style:{ padding:'100px 24px 100px',maxWidth:700,margin:'0 auto' } },
    React.createElement(SectionHeader, { title:'My Tickets', subtitle:tickets.length+' ticket'+(tickets.length!==1?'s':'')+' for '+user.name }),
    tickets.length===0
      ? React.createElement(FuturisticCard, { style:{ textAlign:'center' } },
          React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:16 } },'No tickets yet. Head to Events to grab your spot.')
        )
      : React.createElement('div', { style:{ display:'flex',flexDirection:'column',gap:20 } },
          tickets.map(t=>React.createElement(TicketCard, { key:t.id,ticket:t }))
        )
  );
}

/* ─── CONTACT ────────────────────────────────────────────────────── */
function PageContact({ user }) {
  const [name, setName] = useState(user?user.name:'');
  const [email, setEmail] = useState(user?user.email:'');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [sponsors, setSponsors] = useState([]);

  useEffect(() => { window.RNTECH_API.getSponsors().then(setSponsors).catch(()=>{}); }, []);

  const inputStyle = { width:'100%',padding:'12px 16px',marginBottom:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:0,color:'#fff',fontSize:15,fontFamily:"'Space Grotesk',sans-serif",outline:'none',boxSizing:'border-box' };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await window.RNTECH_API.submitMessage(name, email, message);
      setSent(true);
    } catch(err) {
      setError(err.message||'Failed to send message');
    }
  };

  return React.createElement('div', { style:{ padding:'100px 24px 100px',maxWidth:600,margin:'0 auto' } },
    React.createElement(SectionHeader, { title:'Get In Touch', subtitle:'Bookings, collabs, press, or just a chat.' }),
    sent
      ? React.createElement('div', { style:{ background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:0,padding:'40px 32px',textAlign:'center' } },
          React.createElement('div', { style:{ fontSize:40,marginBottom:16 } },'✓'),
          React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:20,color:'#10b981',margin:'0 0 8px' } },'Message sent!'),
          React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',margin:0 } },"We'll be in touch soon.")
        )
      : React.createElement('form', { onSubmit:submit },
          React.createElement('input', { placeholder:'Your Name',value:name,onChange:e=>setName(e.target.value),required:true,style:inputStyle }),
          React.createElement('input', { type:'email',placeholder:'Email Address',value:email,onChange:e=>setEmail(e.target.value),required:true,style:inputStyle }),
          React.createElement('textarea', { placeholder:'Your message…',value:message,onChange:e=>setMessage(e.target.value),required:true,rows:6,style:{ ...inputStyle,resize:'vertical',marginBottom:20 } }),
          error&&React.createElement('div', { style:{ color:'#ef4444',fontSize:13,marginBottom:12,fontFamily:"'Space Grotesk',sans-serif" } }, error),
          React.createElement(GlowButton, { style:{ width:'100%' } },'Send Message')
        ),
    sponsors.length>0&&React.createElement('div', { style:{ marginTop:48,display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 } },
      sponsors.map(s=>React.createElement(FuturisticCard, { key:s.id },
        s.logo&&React.createElement('img', { src:s.logo,alt:s.name,style:{ height:72,width:72,objectFit:'contain',filter:'brightness(1.1) contrast(1.1)',marginBottom:12,display:'block' } }),
        React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:14,color:'#fff',textTransform:'uppercase',marginBottom:4 } }, s.name),
        React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:12 } }, s.subtitle),
        React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:13,margin:'8px 0 0',lineHeight:1.5 } }, s.description)
      ))
    )
  );
}

Object.assign(window, { PageHome, PageEvents, PageMixes, PageTickets, PageContact });
