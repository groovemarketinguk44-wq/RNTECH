// Public pages: Home, Events, EventDetail, Mixes, Tickets, Contact
var { useState, useEffect } = React;

// Renders **bold** markers and blank-line paragraph breaks from a plain-text description field
function renderBio(text) {
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.map((para, i) =>
    React.createElement('p', { key:i, style:{ margin:i===paragraphs.length-1?0:'0 0 6px' } },
      para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
        chunk.startsWith('**') && chunk.endsWith('**')
          ? React.createElement('strong', { key:j, style:{ color:'#fff',fontWeight:700 } }, chunk.slice(2,-2))
          : chunk
      )
    )
  );
}

// Small Instagram pill shown under a DJ's name when they have a handle on file — styled
// like the site's primary CTA buttons (same gradient + glow) rather than a plain icon link.
function InstagramLink({ handle }) {
  if (!handle) return null;
  return React.createElement('a', {
    href:`https://instagram.com/${handle}`, target:'_blank', rel:'noopener noreferrer',
    onClick:e=>e.stopPropagation(),
    title:'@'+handle,
    style:{
      position:'absolute', top:-10, right:-10, zIndex:2,
      display:'flex', alignItems:'center', justifyContent:'center',
      width:26, height:26, borderRadius:'50%',
      border:'2px solid #050c17',
      background:'linear-gradient(135deg,#3272a8,#9f84b2,#3272a8)', backgroundSize:'200% 200%',
      animation:'btnGlow 3s ease infinite',
      color:'#fff', textDecoration:'none',
      boxShadow:'0 0 14px rgba(50,114,168,0.5), 0 0 28px rgba(159,132,178,0.25)',
    }
  },
    React.createElement('svg', { width:14, height:14, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2.2 },
      React.createElement('rect', { x:2, y:2, width:20, height:20, rx:5 }),
      React.createElement('circle', { cx:12, cy:12, r:4.2 }),
      React.createElement('circle', { cx:17.3, cy:6.7, r:0.9, fill:'currentColor', stroke:'none' })
    )
  );
}

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
      React.createElement('div', { style:{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:48,textAlign:'center'} },
        React.createElement('p', { style:{ fontFamily:"'Ethnocentric Rg','Orbitron',sans-serif",fontWeight:200,fontStretch:'expanded',color:'rgba(255,255,255,0.45)',fontSize:'clamp(9px,1.4vw,13px)',letterSpacing:'0.38em',textTransform:'uppercase',lineHeight:1.4,margin:'0 0 10px',width:'min(280px,60vw)' } }, 'On a journey'),
        React.createElement('div', { style:{filter:'drop-shadow(0 0 10px rgba(255,255,255,0.8)) drop-shadow(0 0 28px rgba(160,210,255,0.6)) drop-shadow(0 0 55px rgba(100,170,255,0.35))'} },
          React.createElement('p', { style:{ fontFamily:"'Ethnocentric Rg','Orbitron',sans-serif",fontWeight:200,fontStretch:'expanded',fontSize:'clamp(26px,4.2vw,50px)',letterSpacing:'0.08em',textTransform:'uppercase',lineHeight:1.1,margin:0,whiteSpace:'nowrap', background:'linear-gradient(90deg,rgba(180,215,255,0.85) 0%,#ffffff 20%,rgba(230,245,255,1) 40%,#ffffff 55%,rgba(200,225,255,0.9) 75%,#ffffff 90%,rgba(180,215,255,0.85) 100%)',backgroundSize:'250% 100%',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',animation:'starShimmer 4s linear infinite' } }, 'To the stars')
        )
      ),
      featured&&React.createElement(FuturisticCard, { active:true, style:{ maxWidth:560,marginBottom:40,textAlign:'center' } },
        featured.posterImage&&React.createElement('img', { src:featured.posterImage, alt:featured.title, style:{ width:'100%',height:160,objectFit:'cover',objectPosition:'center 60%',display:'block',marginBottom:16 } }),
        React.createElement(Chip, { label:'Next Event', color:'#10b981' }),
        React.createElement('h2', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:'clamp(22px,4vw,36px)',color:'#fff',margin:'12px 0 8px',textTransform:'uppercase',letterSpacing:'-0.02em' } }, featured.title),
        React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'#3272a8',fontWeight:600,marginBottom:4 } }, [featured.displayDate,featured.startTime].filter(Boolean).join(' · ')),
        React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:14,marginBottom:24 } }, [featured.venue,featured.location].filter(Boolean).join(', ')),
        React.createElement('div', { style:{ display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap' } },
          React.createElement(GlowButton, { onClick:()=>onNavigate('events', { eventId:featured.id, action:'ticket' }), variant:'primary' }, featured.registrationMode==='interest'?'Register Interest':'Get Tickets'),
          React.createElement(GlowButton, { onClick:()=>onNavigate('events', { eventId:featured.id, action:'detail' }), variant:'ghost' }, 'View Lineup')
        )
      ),
      !user&&React.createElement('button', { onClick:()=>onAuth('register'), style:{ background:'none',border:'none',cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:14,textDecoration:'underline' } },'Create an account to save your tickets →')
    ),

    // Lineup
    featured&&featured.lineup.length>0&&React.createElement('section', { style:{ padding:'60px 24px',maxWidth:900,margin:'0 auto' } },
      React.createElement(SectionHeader, { title:'Lineup', subtitle:featured.title+' · '+featured.displayDate }),
      React.createElement('div', { style:{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:16 } },
        featured.lineup.map(dj=>React.createElement(FuturisticCard, { key:dj.name,active:dj.role==='Headliner',style:{ textAlign:'center' } },
          React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:14,color:'#fff',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:dj.role==='Headliner'?8:0 } }, dj.name),
          dj.role==='Headliner'&&React.createElement(Chip, { label:'Headliner', color:'#3272a8' }),
          React.createElement(InstagramLink, { handle:dj.instagram })
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
function PageEvents({ user, onAuth, onLogin, onPlayMix, pendingEventIntent, onConsumeEventIntent }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [ticketEvent, setTicketEvent] = useState(null);
  const [ticketSuccess, setTicketSuccess] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [holderName, setHolderName] = useState(user?user.name:'');
  const [holderEmail, setHolderEmail] = useState(user?user.email:'');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [pendingAuthEventId, setPendingAuthEventId] = useState(null);
  // Interest / waitlist state
  const [interestEvent, setInterestEvent] = useState(null);
  const [interestFirst, setInterestFirst] = useState('');
  const [interestLast, setInterestLast] = useState('');
  const [interestEmail, setInterestEmail] = useState('');
  const [interestInstagram, setInterestInstagram] = useState('');
  const [interestPassword, setInterestPassword] = useState('');
  const [interestBusy, setInterestBusy] = useState(false);
  const [interestError, setInterestError] = useState('');
  const [interestDone, setInterestDone] = useState(false);

  useEffect(() => {
    window.RNTECH_API.getEvents().then(ev => { setEvents(ev); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  const openTicketModal = (event) => {
    setSelectedType(null);
    setQuantity(1);
    setTicketEvent(event);
    setHolderName(user ? user.name : '');
    setHolderEmail(user ? user.email : '');
    setBuyError('');
  };

  const handleRegister = (event) => {
    if (event.registrationMode === 'closed') { alert('Registration for this event is now closed.'); return; }
    if (event.registrationMode === 'interest') {
      // Interest registration swaps in a full page (not an overlay), so jump to its top.
      // The ticket modal below is a fixed overlay instead, so it doesn't need this.
      window.scrollTo(0, 0);
      setInterestEvent(event);
      setInterestFirst(user ? (user.firstName || '') : '');
      setInterestLast(user ? (user.lastName || '') : '');
      setInterestEmail(user ? user.email : '');
      setInterestInstagram(''); setInterestPassword(''); setInterestError(''); setInterestDone(false);
      return;
    }
    openTicketModal(event);
  };

  // Home page "Get Tickets" / "View Lineup" hand off a specific event to act on here
  useEffect(() => {
    if (!pendingEventIntent || !events.length) return;
    const ev = pendingEventIntent.eventId === 'featured'
      ? events.find(e => e.featured && e.status === 'upcoming') || events.find(e => e.status === 'upcoming')
      : events.find(e => e.id === pendingEventIntent.eventId);
    if (ev) {
      if (pendingEventIntent.action === 'detail') setSelected(ev);
      else handleRegister(ev);
    }
    onConsumeEventIntent && onConsumeEventIntent();
  }, [pendingEventIntent, events]);

  // Resume the purchase once sign-in/registration completes, without re-picking tickets
  useEffect(() => {
    if (!user || !pendingAuthEventId) return;
    setPendingAuthEventId(null);
    if (ticketEvent && ticketEvent.id === pendingAuthEventId && selectedType) doPurchase();
  }, [user]);

  const doInterest = async () => {
    if (!interestFirst.trim() || !interestLast.trim()) { setInterestError('Please enter your first and last name.'); return; }
    if (!interestEmail.trim()) { setInterestError('Please enter your email.'); return; }
    if (!user && !interestPassword.trim()) { setInterestError('Please set a password for your account.'); return; }
    setInterestBusy(true); setInterestError('');
    try {
      const res = await window.RNTECH_API.submitInterest(interestEvent.id, {
        firstName: interestFirst.trim(), lastName: interestLast.trim(),
        email: interestEmail.trim(), instagram: interestInstagram.trim(),
        password: interestPassword,
      });
      if (res.token && res.user) {
        window.RNTECH_AUTH.setToken(res.token);
        window.RNTECH_AUTH.setUser(res.user);
        if (onLogin) onLogin(res.user);
      }
      setInterestDone(true);
    } catch(err) {
      setInterestError(err.message || 'Something went wrong');
    } finally { setInterestBusy(false); }
  };

  // Issues the ticket / kicks off Stripe checkout once we know who's buying
  const doPurchase = async () => {
    setBuying(true);
    setBuyError('');
    try {
      if (selectedType.price === 0) {
        const ticket = await window.RNTECH_API.issueTicket({
          ticketTypeId: selectedType.id,
          holderName, holderEmail, quantity,
        });
        setTicketSuccess(ticket);
        setTicketEvent(null);
      } else {
        const { url } = await window.RNTECH_API.createCheckoutSession({
          ticketTypeId: selectedType.id,
          holderName, holderEmail, quantity,
        });
        window.location.href = url; // off to Stripe Checkout
        return;
      }
    } catch(err) {
      if (err.status === 409) {
        // Email already belongs to a registered account — don't silently attach
        // the ticket to it, send them to sign in and resume once they're back
        setBuyError('That email already has an RNTECH account — sign in to continue your purchase.');
        setPendingAuthEventId(ticketEvent.id);
        onAuth('login', holderEmail);
      } else {
        setBuyError(err.message||'Failed to process ticket');
      }
    } finally {
      setBuying(false);
    }
  };

  const doTicket = () => {
    if (!selectedType) return;
    doPurchase();
  };

  if (loading) return React.createElement('div',{style:{padding:'120px 24px'}},React.createElement(Spinner));
  const upcoming = events.filter(e=>e.status==='upcoming');
  const past = events.filter(e=>e.status==='past');
  const inputStyle = { width:'100%',padding:'9px 14px',marginBottom:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:0,color:'#fff',fontSize:14,fontFamily:"'Space Grotesk',sans-serif",outline:'none',boxSizing:'border-box' };

  // A fixed-overlay modal, so it needs to render on top of whichever sub-view (list / event
  // detail / interest form) is active below — it used to live only inside the default list
  // branch, so buying a ticket from the event-detail page silently set ticketEvent but the
  // modal never rendered (that branch returned before ever reaching this code).
  const ticketModal = ticketEvent&&React.createElement('div', { className:'modal-overlay', style:{ position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }, onClick:()=>setTicketEvent(null) },
    React.createElement('div', { className:'modal-sheet', onClick:e=>e.stopPropagation(), style:{ background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',borderRadius:0,padding:16,width:'100%',maxWidth:440,maxHeight:'94vh',overflowY:'auto',boxShadow:'0 0 60px rgba(50,114,168,0.2)' } },
      React.createElement('div',{className:'modal-handle'}),
      React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:16,color:'#fff',margin:'0 0 3px',textTransform:'uppercase' } },'Get Tickets'),
      React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:10,marginBottom:8 } }, ticketEvent.title+' · '+ticketEvent.displayDate),
      ticketEvent.ticketBannerImage&&React.createElement('img', { src:ticketEvent.ticketBannerImage, alt:ticketEvent.title, style:{ width:'100%',height:85,objectFit:'cover',objectPosition:'center 75%',display:'block',marginBottom:8 } }),
      ticketEvent.ticketBio&&React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.6)',fontSize:10.5,lineHeight:1.4,marginBottom:10 } }, renderBio(ticketEvent.ticketBio)),
      React.createElement('div', { style:{ display:'flex',flexDirection:'column',gap:5,marginBottom:10 } },
        (ticketEvent.ticketTypes||[]).filter(t=>t.active).map(t=>{
          const isSel = selectedType&&selectedType.id===t.id;
          const remaining = Math.max((t.capacity||0)-(t.soldCount||0), 0);
          const soldOut = t.soldOut||remaining<=0;
          const maxQty = Math.max(Math.min(10, remaining), soldOut?0:1);
          return React.createElement('div', { key:t.id, onClick:soldOut?undefined:()=>{ if(isSel){ setSelectedType(null); } else { setSelectedType(t); setQuantity(1); } }, style:{ position:'relative',overflow:'visible',background:isSel?'rgba(50,114,168,0.15)':'rgba(255,255,255,0.03)',border:`1px solid ${isSel?'rgba(50,114,168,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:0,padding:'8px 10px',cursor:soldOut?'default':'pointer',display:'flex',justifyContent:'space-between',alignItems:'center' } },
            React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:13,color:soldOut?'rgba(255,255,255,0.35)':'#fff',textDecoration:soldOut?'line-through':'none' } }, t.name),
            soldOut
              ? React.createElement('div', { style:{ display:'flex',alignItems:'center',gap:8 } },
                  t.price>0&&React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:13,color:'rgba(255,255,255,0.35)',textDecoration:'line-through' } }, '£'+(t.price/100).toFixed(2)),
                  React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:13,letterSpacing:'0.06em',color:'#e5484d',textTransform:'uppercase' } }, 'Sold Out')
                )
              : isSel
              ? React.createElement('div', { onClick:e=>e.stopPropagation(), style:{ display:'flex',alignItems:'center',gap:8,border:'1px solid rgba(255,255,255,0.2)',padding:'2px 8px' } },
                  React.createElement('button', { onClick:()=>setQuantity(q=>Math.max(1,q-1)), disabled:quantity<=1, style:{ background:'none',border:'none',color:quantity<=1?'rgba(255,255,255,0.2)':'#fff',fontSize:15,cursor:quantity<=1?'default':'pointer',fontFamily:"'Space Grotesk',sans-serif",padding:'0 3px' } }, '−'),
                  React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'#fff',fontSize:13,fontWeight:700,minWidth:14,textAlign:'center' } }, quantity),
                  React.createElement('button', { onClick:()=>setQuantity(q=>Math.min(maxQty,q+1)), disabled:quantity>=maxQty, style:{ background:'none',border:'none',color:quantity>=maxQty?'rgba(255,255,255,0.2)':'#fff',fontSize:15,cursor:quantity>=maxQty?'default':'pointer',fontFamily:"'Space Grotesk',sans-serif",padding:'0 3px' } }, '+')
                )
              : React.createElement('div', { style:{ display:'flex',alignItems:'center',gap:8 } },
                  t.nearlyGone&&React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:9.5,letterSpacing:'0.05em',textTransform:'uppercase',color:'#f59e0b' } }, 'Nearly Gone'),
                  React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:14,color:t.price===0?'#10b981':'#fff' } }, t.price===0?'FREE':'£'+(t.price/100).toFixed(2))
                )
          );
        })
      ),
      React.createElement('div', { style:{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8 } },
        React.createElement('input', { placeholder:'Your Name',value:holderName,onChange:e=>setHolderName(e.target.value),style:{...inputStyle,marginBottom:0} }),
        React.createElement('input', { type:'email',placeholder:'Your Email',value:holderEmail,onChange:e=>setHolderEmail(e.target.value),style:{...inputStyle,marginBottom:0} })
      ),
      !user&&React.createElement('p', { style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.3)',fontSize:9.5,margin:'0 0 6px',lineHeight:1.35} },"We'll set up a free RNTECH account with these details so your ticket is always there under My Tickets."),
      buyError&&React.createElement('div', { style:{ color:'#ef4444',fontSize:11,marginBottom:6,fontFamily:"'Space Grotesk',sans-serif" } }, buyError),
      React.createElement(GlowButton, { onClick:doTicket,style:{ width:'100%',marginTop:0,padding:'10px 18px'},disabled:buying },
        buying?'Processing…':selectedType&&selectedType.price===0
          ?(quantity>1?`Confirm ${quantity} Free Tickets`:'Confirm Free Ticket')
          :(quantity>1&&selectedType?`Pay £${(selectedType.price*quantity/100).toFixed(2)} — ${quantity} Tickets`:'Confirm Purchase'))
    )
  );

  if (interestEvent) {
    const iSt = { width:'100%',padding:'12px 16px',marginBottom:12,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:0,color:'#fff',fontSize:14,fontFamily:"'Space Grotesk',sans-serif",outline:'none',boxSizing:'border-box' };
    return React.createElement(React.Fragment, null,
      React.createElement('div', { style:{ padding:'100px 24px 80px',maxWidth:500,margin:'0 auto' } },
        React.createElement('button', { onClick:()=>{ setInterestEvent(null); setInterestDone(false); }, style:{ background:'none',border:'none',cursor:'pointer',fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:14,marginBottom:32,display:'flex',alignItems:'center',gap:8,padding:0 } },'← Back to Events'),
        interestDone
          ? React.createElement('div', { style:{ textAlign:'center' } },
              React.createElement('div', { style:{ fontSize:48,marginBottom:16 } },'✓'),
              React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:22,color:'#10b981',margin:'0 0 12px',textTransform:'uppercase' } },"You're on the list!"),
              React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:14,marginBottom:24 } },"We'll be in touch when spots open up. You're now signed in to your RNTECH account."),
              React.createElement(GlowButton, { onClick:()=>{ setInterestEvent(null); setInterestDone(false); }, style:{ width:'100%' } },'Back to Events')
            )
          : React.createElement('div', null,
              React.createElement(SectionHeader, { title:'Register Interest', subtitle:interestEvent.title+' · '+interestEvent.displayDate }),
              React.createElement('div', { style:{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:0 } },
                React.createElement('input', { placeholder:'First Name',value:interestFirst,onChange:e=>setInterestFirst(e.target.value),style:iSt }),
                React.createElement('input', { placeholder:'Last Name',value:interestLast,onChange:e=>setInterestLast(e.target.value),style:iSt })
              ),
              React.createElement('input', { type:'email',placeholder:'Email Address',value:interestEmail,onChange:e=>setInterestEmail(e.target.value),style:iSt }),
              React.createElement('input', { placeholder:'Instagram handle (optional)',value:interestInstagram,onChange:e=>setInterestInstagram(e.target.value),style:{...iSt,opacity:0.75} }),
              !user&&React.createElement('input', { type:'password',placeholder:'Set a password for your RNTECH account',value:interestPassword,onChange:e=>setInterestPassword(e.target.value),minLength:6,style:iSt }),
              !user&&React.createElement('p', { style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.3)',fontSize:11,marginBottom:12,lineHeight:1.5} },'Registering creates your RNTECH account. Already have one? Enter your password above.'),
              interestError&&React.createElement('div', { style:{ color:'#ef4444',fontSize:13,marginBottom:12,fontFamily:"'Space Grotesk',sans-serif" } }, interestError),
              React.createElement(GlowButton, { onClick:doInterest,style:{ width:'100%' },disabled:interestBusy }, interestBusy?'Sending…':'Register Interest')
            )
      ),
      ticketModal
    );
  }

  if (selected) return React.createElement(React.Fragment, null,
    React.createElement(EventDetail, { event:selected,user,onBack:()=>setSelected(null),onRegister:handleRegister }),
    ticketModal
  );

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style:{ padding:'100px 24px 100px',maxWidth:900,margin:'0 auto' } },
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
      )
    ),
    ticketModal
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
    React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'#3272a8',fontSize:18,fontWeight:600,marginBottom:4 } }, [event.displayDate,event.startTime&&event.endTime?event.startTime+' – '+event.endTime:event.startTime].filter(Boolean).join(' · ')),
    React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',marginBottom:32 } }, [event.venue,event.location].filter(Boolean).join(', ')),
    React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.7)',fontSize:16,lineHeight:1.8,marginBottom:40 } }, event.description),
    event.lineup&&event.lineup.length>0&&React.createElement('div', null,
      React.createElement('h2', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:22,color:'#fff',textTransform:'uppercase',marginBottom:20 } },'Lineup'),
      React.createElement('div', { style:{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:40 } },
        event.lineup.map(dj=>React.createElement(FuturisticCard, { key:dj.name,active:dj.role==='Headliner',style:{ textAlign:'center' } },
          React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:14,color:'#fff',textTransform:'uppercase',marginBottom:dj.role==='Headliner'?8:0 } }, dj.name),
          dj.role==='Headliner'&&React.createElement(Chip, { label:'Headliner', color:'#06b6d4' }),
          React.createElement(InstagramLink, { handle:dj.instagram })
        ))
      )
    ),
    event.giveaways&&event.giveaways.length>0&&React.createElement('div', { style:{ marginBottom:40 } },
      React.createElement('h2', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:22,color:'#fff',textTransform:'uppercase',marginBottom:16 } },'On The Night'),
      event.giveaways.map((g,i)=>React.createElement('div', { key:i, style:{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.7)',fontSize:14 } },
        React.createElement('span', { style:{ color:'#10b981',fontSize:16 } },'✓'), g
      ))
    ),
    event.status==='upcoming'&&React.createElement(GlowButton, { onClick:()=>onRegister(event) },
      event.registrationMode==='interest'?'Register Interest':event.isFree?'Get Free Ticket':'Buy Ticket')
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
function WaitlistCard({ interest, onBuyNow }) {
  const ev = interest.event || {};
  const invited = interest.status === 'invited';
  const badgeColor = invited ? '#10b981' : '#f59e0b';
  return React.createElement(FuturisticCard, null,
    React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16} },
      React.createElement('div', null,
        React.createElement('span', { style:{display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',background:invited?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)',color:badgeColor,border:`1px solid ${invited?'rgba(16,185,129,0.35)':'rgba(245,158,11,0.35)'}`,fontFamily:"'Space Grotesk',sans-serif",marginBottom:10} }, invited ? 'Invited — Buy Now' : 'On The List'),
        React.createElement('h3', { style:{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:20,color:'#fff',margin:'0 0 4px',textTransform:'uppercase'} }, ev.title||'Event'),
        React.createElement('div', { style:{fontFamily:"'Space Grotesk',sans-serif",color:badgeColor,fontSize:13,fontWeight:600} }, ev.displayDate||''),
        React.createElement('div', { style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:12,marginTop:2} }, ev.venue&&ev.location ? ev.venue+', '+ev.location : '')
      ),
      React.createElement('div', { style:{width:52,height:52,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:invited?'rgba(16,185,129,0.1)':'rgba(245,158,11,0.1)',border:`1px solid ${invited?'rgba(16,185,129,0.3)':'rgba(245,158,11,0.3)'}`,fontSize:22} }, invited?'✉️':'⏳')
    ),
    React.createElement('div', { style:{background:invited?'rgba(16,185,129,0.06)':'rgba(245,158,11,0.06)',border:`1px solid ${invited?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)'}`,padding:'14px 16px',marginBottom:invited&&interest.inviteToken?12:0} },
      React.createElement('p', { style:{fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.65)',fontSize:13,lineHeight:1.7,margin:0} },
        invited
          ? "You've been invited to buy your ticket! Click below, or use the personal checkout link we emailed you."
          : "You're registered for this exclusive event. Keep your eyes peeled — if you make the cut, your invite to buy will come through. We'll be in touch."
      )
    ),
    invited && interest.inviteToken && React.createElement(GlowButton, { onClick:()=>onBuyNow(interest.inviteToken), style:{ width:'100%' } }, 'Buy Ticket Now')
  );
}

/* ─── INVITE CHECKOUT (waitlist "buy now" landing) ─────────────────── */
function InviteModal({ token, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [holderName, setHolderName] = useState('');
  const [holderEmail, setHolderEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    window.RNTECH_API.getInvite(token).then(d => {
      setInvite(d);
      if (!d.used) {
        setHolderName(d.holderName||'');
        setHolderEmail(d.holderEmail||'');
        setSelectedTypeId((d.ticketTypes&&d.ticketTypes[0]||{}).id||null);
      }
      setLoading(false);
    }).catch(err => { setError(err.message||'This invite link was not found.'); setLoading(false); });
  }, [token]);

  useEffect(() => { setQuantity(1); }, [selectedTypeId]);

  const buy = async () => {
    if (!selectedTypeId) { setError('Please choose a ticket type.'); return; }
    if (!holderName.trim() || !holderEmail.trim()) { setError('Please enter your name and email.'); return; }
    setBuying(true); setError('');
    try {
      const { url } = await window.RNTECH_API.createCheckoutSession({
        ticketTypeId: selectedTypeId,
        holderName: holderName.trim(), holderEmail: holderEmail.trim(),
        inviteToken: token, quantity,
      });
      window.location.href = url;
    } catch(err) {
      setError(err.message||'Failed to start checkout');
      setBuying(false);
    }
  };

  const inputStyle = { width:'100%',padding:'12px 16px',marginBottom:12,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:0,color:'#fff',fontSize:14,fontFamily:"'Space Grotesk',sans-serif",outline:'none',boxSizing:'border-box' };
  const selectedType = invite && invite.ticketTypes ? invite.ticketTypes.find(t=>t.id===selectedTypeId) : null;
  const maxQty = Math.max(Math.min(10, selectedType?selectedType.remaining:1), 1);

  return React.createElement('div', { className:'modal-overlay', style:{ position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }, onClick:onClose },
    React.createElement('div', { className:'modal-sheet', onClick:e=>e.stopPropagation(), style:{ background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',borderRadius:0,padding:36,width:'100%',maxWidth:440,boxShadow:'0 0 60px rgba(50,114,168,0.2)' } },
      loading && React.createElement(Spinner),
      !loading && error && !invite && React.createElement('div', null,
        React.createElement('p', { style:{ color:'#ef4444',fontFamily:"'Space Grotesk',sans-serif",marginBottom:20 } }, error),
        React.createElement(GlowButton, { onClick:onClose, variant:'ghost' }, 'Close')
      ),
      !loading && invite && invite.used && React.createElement('div', null,
        React.createElement('div', { style:{ fontSize:40,marginBottom:16 } }, '✓'),
        React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:20,color:'#10b981',margin:'0 0 12px',textTransform:'uppercase' } }, 'Already Claimed'),
        React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:14,marginBottom:24 } }, 'This invite link has already been used.'),
        React.createElement(GlowButton, { onClick:onClose, style:{ width:'100%' } }, 'Close')
      ),
      !loading && invite && !invite.used && React.createElement('div', null,
        React.createElement('h3', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:22,color:'#fff',margin:'0 0 6px',textTransform:'uppercase' } }, "You're Invited"),
        React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:4 } }, invite.event.title+' · '+invite.event.displayDate),
        invite.discountPercent > 0 && React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'#10b981',fontSize:13,fontWeight:700,marginBottom:16 } }, invite.discountPercent+'% off any ticket below'),
        React.createElement('div', { style:{ display:'flex',flexDirection:'column',gap:10,marginBottom:20 } },
          invite.ticketTypes.map(t=>
            React.createElement('div', { key:t.id, onClick:()=>setSelectedTypeId(t.id), style:{ background:selectedTypeId===t.id?'rgba(50,114,168,0.15)':'rgba(255,255,255,0.03)',border:`1px solid ${selectedTypeId===t.id?'rgba(50,114,168,0.5)':'rgba(255,255,255,0.1)'}`,padding:'14px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center' } },
              React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:14,color:'#fff' } }, t.name),
              invite.discountPercent > 0
                ? React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif" } },
                    React.createElement('span', { style:{ textDecoration:'line-through',color:'rgba(255,255,255,0.4)',marginRight:8,fontSize:13 } }, '£'+(t.price/100).toFixed(2)),
                    React.createElement('span', { style:{ fontWeight:800,fontSize:16,color:'#10b981' } }, '£'+(t.discountedPrice/100).toFixed(2))
                  )
                : React.createElement('div', { style:{ fontWeight:800,fontSize:16,color:'#fff',fontFamily:"'Space Grotesk',sans-serif" } }, '£'+(t.discountedPrice/100).toFixed(2))
            )
          )
        ),
        selectedType && React.createElement('div', { style:{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 } },
          React.createElement('span', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',fontSize:12,textTransform:'uppercase',letterSpacing:'0.06em' } }, 'Quantity'),
          React.createElement('div', { style:{ display:'flex',alignItems:'center',gap:10,border:'1px solid rgba(255,255,255,0.2)',padding:'4px 10px' } },
            React.createElement('button', { onClick:()=>setQuantity(q=>Math.max(1,q-1)), disabled:quantity<=1, style:{ background:'none',border:'none',color:quantity<=1?'rgba(255,255,255,0.2)':'#fff',fontSize:16,cursor:quantity<=1?'default':'pointer',fontFamily:"'Space Grotesk',sans-serif",padding:'0 4px' } }, '−'),
            React.createElement('div', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'#fff',fontSize:14,fontWeight:700,minWidth:16,textAlign:'center' } }, quantity),
            React.createElement('button', { onClick:()=>setQuantity(q=>Math.min(maxQty,q+1)), disabled:quantity>=maxQty, style:{ background:'none',border:'none',color:quantity>=maxQty?'rgba(255,255,255,0.2)':'#fff',fontSize:16,cursor:quantity>=maxQty?'default':'pointer',fontFamily:"'Space Grotesk',sans-serif",padding:'0 4px' } }, '+')
          )
        ),
        React.createElement('input', { placeholder:'Your Name',value:holderName,onChange:e=>setHolderName(e.target.value),style:inputStyle }),
        React.createElement('input', { type:'email',placeholder:'Your Email',value:holderEmail,onChange:e=>setHolderEmail(e.target.value),style:inputStyle }),
        error && React.createElement('div', { style:{ color:'#ef4444',fontSize:13,marginBottom:12,fontFamily:"'Space Grotesk',sans-serif" } }, error),
        React.createElement(GlowButton, { onClick:buy, style:{ width:'100%' }, disabled:buying||!selectedType },
          buying?'Redirecting…':selectedType&&quantity>1?`Pay £${(selectedType.discountedPrice*quantity/100).toFixed(2)} — ${quantity} Tickets`:'Pay & Claim Ticket')
      )
    )
  );
}

/* ─── PERSONAL OFFER (emailed discount link — one person, one use) ─────────── */
function OfferModal({ token, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offer, setOffer] = useState(null);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const FSG = "'Space Grotesk',sans-serif";

  useEffect(() => {
    window.RNTECH_API.getOffer(token).then(d => {
      setOffer(d);
      if (d.state === 'ok') setSelectedTypeId((d.ticketTypes[0] || {}).id || null);
      setLoading(false);
    }).catch(err => { setError(err.message || "This link isn't valid."); setLoading(false); });
  }, [token]);

  useEffect(() => { setQuantity(1); }, [selectedTypeId]);

  const buy = async () => {
    if (!selectedTypeId) { setError('Please choose a ticket.'); return; }
    setBuying(true); setError('');
    try {
      const { url } = await window.RNTECH_API.createCheckoutSession({ ticketTypeId:selectedTypeId, offerToken:token, quantity });
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Failed to start checkout');
      setBuying(false);
    }
  };

  const messages = {
    used: ['Offer already used', 'This personal offer has already been used. Each link works for one purchase only.'],
    expired: ['Offer expired', 'This offer has expired.'],
    revoked: ['Offer unavailable', 'This offer is no longer available.'],
    sold_out: ['Sold out', 'Everything in this offer has sold out.'],
    wrong_account: ['This offer is personal', "This link was made for someone else's account, so it can't be used while you're signed in as a different person. Sign out and open the link again only if it's yours."],
  };
  const selectedType = offer && offer.ticketTypes ? offer.ticketTypes.find(t => t.id === selectedTypeId) : null;
  const maxQty = selectedType ? Math.max(Math.min(offer.maxTickets, selectedType.remaining), 1) : 1;

  return React.createElement('div', { className:'modal-overlay', style:{ position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }, onClick:onClose },
    React.createElement('div', { className:'modal-sheet', onClick:e => e.stopPropagation(), style:{ background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',borderRadius:0,padding:36,width:'100%',maxWidth:440,boxShadow:'0 0 60px rgba(50,114,168,0.2)' } },
      loading && React.createElement(Spinner),
      !loading && !offer && React.createElement('div', null,
        React.createElement('p', { style:{ color:'#ef4444',fontFamily:FSG,marginBottom:20 } }, error || "This link isn't valid."),
        React.createElement(GlowButton, { onClick:onClose, variant:'ghost' }, 'Close')
      ),
      !loading && offer && offer.state !== 'ok' && React.createElement('div', null,
        React.createElement('h3', { style:{ fontFamily:FSG,fontWeight:800,fontSize:20,color:'#fff',margin:'0 0 12px',textTransform:'uppercase' } }, (messages[offer.state] || messages.revoked)[0]),
        React.createElement('p', { style:{ fontFamily:FSG,color:'rgba(255,255,255,0.55)',fontSize:14,lineHeight:1.6,marginBottom:24 } }, (messages[offer.state] || messages.revoked)[1]),
        React.createElement(GlowButton, { onClick:onClose, style:{ width:'100%' } }, 'Close')
      ),
      !loading && offer && offer.state === 'ok' && React.createElement('div', null,
        React.createElement('h3', { style:{ fontFamily:FSG,fontWeight:800,fontSize:22,color:'#fff',margin:'0 0 6px',textTransform:'uppercase' } }, 'Your Personal Offer'),
        React.createElement('p', { style:{ fontFamily:FSG,color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:4 } }, offer.event.title + ' · ' + offer.event.displayDate),
        React.createElement('p', { style:{ fontFamily:FSG,color:'#10b981',fontSize:14,fontWeight:700,marginBottom:6 } }, (offer.firstName ? offer.firstName + ', ' : '') + offer.discountLabel + ' any ticket below'),
        React.createElement('p', { style:{ fontFamily:FSG,color:'rgba(255,255,255,0.4)',fontSize:12,lineHeight:1.5,marginBottom:16 } }, "This link is personal to you and works once, for up to " + offer.maxTickets + " tickets. Tickets are sent to " + offer.maskedEmail + '.'),
        React.createElement('div', { style:{ display:'flex',flexDirection:'column',gap:10,marginBottom:20 } },
          offer.ticketTypes.map(t => React.createElement('div', { key:t.id, onClick:() => setSelectedTypeId(t.id), style:{ background:selectedTypeId===t.id?'rgba(50,114,168,0.15)':'rgba(255,255,255,0.03)',border:`1px solid ${selectedTypeId===t.id?'rgba(50,114,168,0.5)':'rgba(255,255,255,0.08)'}`,padding:'14px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center' } },
            React.createElement('div', { style:{ fontFamily:FSG,fontWeight:700,fontSize:14,color:'#fff' } }, t.name),
            React.createElement('div', { style:{ fontFamily:FSG } },
              React.createElement('span', { style:{ textDecoration:'line-through',color:'rgba(255,255,255,0.4)',marginRight:8,fontSize:13 } }, '£' + (t.price / 100).toFixed(2)),
              React.createElement('span', { style:{ fontWeight:800,fontSize:16,color:'#10b981' } }, '£' + (t.discountedPrice / 100).toFixed(2))
            )
          ))
        ),
        selectedType && React.createElement('div', { style:{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 } },
          React.createElement('span', { style:{ fontFamily:FSG,color:'rgba(255,255,255,0.5)',fontSize:12,textTransform:'uppercase',letterSpacing:'0.06em' } }, 'Quantity'),
          React.createElement('div', { style:{ display:'flex',alignItems:'center',gap:10,border:'1px solid rgba(255,255,255,0.2)',padding:'4px 10px' } },
            React.createElement('button', { onClick:() => setQuantity(q => Math.max(1, q - 1)), disabled:quantity <= 1, style:{ background:'none',border:'none',color:quantity<=1?'rgba(255,255,255,0.2)':'#fff',fontSize:16,cursor:quantity<=1?'default':'pointer',fontFamily:FSG } }, '−'),
            React.createElement('div', { style:{ fontFamily:FSG,color:'#fff',fontSize:14,fontWeight:700,minWidth:16,textAlign:'center' } }, quantity),
            React.createElement('button', { onClick:() => setQuantity(q => Math.min(maxQty, q + 1)), disabled:quantity >= maxQty, style:{ background:'none',border:'none',color:quantity>=maxQty?'rgba(255,255,255,0.2)':'#fff',fontSize:16,cursor:quantity>=maxQty?'default':'pointer',fontFamily:FSG } }, '+')
          )
        ),
        error && React.createElement('div', { style:{ color:'#ef4444',fontSize:13,marginBottom:12,fontFamily:FSG } }, error),
        React.createElement(GlowButton, { onClick:buy, style:{ width:'100%' }, disabled:buying || !selectedType },
          buying ? 'Redirecting…' : selectedType && quantity > 1 ? `Pay £${(selectedType.discountedPrice * quantity / 100).toFixed(2)} — ${quantity} Tickets` : 'Pay & Claim Ticket')
      )
    )
  );
}

function PageTickets({ user, onAuth, checkoutInfo }) {
  const [tickets, setTickets] = useState([]);
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paidTicketId, setPaidTicketId] = useState(null);
  const [polling, setPolling] = useState(false);
  const [buyToken, setBuyToken] = useState(null);

  const reload = () => {
    if (!user) { setLoading(false); return; }
    return Promise.all([
      window.RNTECH_API.myTickets(),
      window.RNTECH_API.myInterests(),
    ]).then(([t, i]) => {
      setTickets(t);
      setInterests(i.filter(x => x.status === 'pending' || x.status === 'invited'));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [user]);

  // After returning from Stripe Checkout, poll briefly until the webhook fulfils the order
  useEffect(() => {
    if (!checkoutInfo || checkoutInfo.status !== 'success' || !checkoutInfo.orderId || !user) return;
    setPolling(true);
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      window.RNTECH_API.getOrderStatus(checkoutInfo.orderId).then(o => {
        if (o.status === 'paid') {
          setPaidTicketId(o.ticketId||null);
          setPolling(false);
          clearInterval(timer);
          reload();
        } else if (attempts >= 8) {
          setPolling(false);
          clearInterval(timer);
        }
      }).catch(() => { setPolling(false); clearInterval(timer); });
    }, 2000);
    return () => clearInterval(timer);
  }, [checkoutInfo, user]);

  if (!user) return React.createElement('div', { style:{ padding:'100px 24px',maxWidth:600,margin:'0 auto',textAlign:'center' } },
    React.createElement('div', { style:{ fontSize:48,marginBottom:20 } },'🎫'),
    React.createElement('h2', { style:{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:28,color:'#fff',textTransform:'uppercase',marginBottom:12 } },'Your Tickets'),
    React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.5)',marginBottom:28 } },'Sign in to view your tickets and QR codes.'),
    React.createElement(GlowButton, { onClick:()=>onAuth('login') },'Sign In'),
    React.createElement('span', { style:{ display:'inline-block',width:12 } }),
    React.createElement(GlowButton, { onClick:()=>onAuth('register'),variant:'ghost' },'Create Account')
  );

  if (loading) return React.createElement('div',{style:{padding:'120px 24px'}},React.createElement(Spinner));

  const total = tickets.length + interests.length;

  // Group tickets from the same purchase (shared orderId) into one swipeable card;
  // order-less tickets (e.g. individually-issued invites) each get their own group of one.
  const ticketGroups = [];
  const groupByOrder = {};
  tickets.forEach(t => {
    const key = t.orderId || t.id;
    if (!groupByOrder[key]) { groupByOrder[key] = []; ticketGroups.push(groupByOrder[key]); }
    groupByOrder[key].push(t);
  });
  return React.createElement('div', { style:{ padding:'100px 24px 100px',maxWidth:700,margin:'0 auto' } },
    React.createElement(SectionHeader, { title:'My Tickets', subtitle:total+' item'+(total!==1?'s':'')+' for '+user.name }),
    checkoutInfo&&checkoutInfo.status==='success'&&React.createElement('div', { style:{ background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:0,padding:20,marginBottom:32,fontFamily:"'Space Grotesk',sans-serif",color:'#10b981' } },
      polling ? '⏳ Payment received — issuing your ticket…' : (paidTicketId ? '✓ Payment confirmed! Ticket ref: '+paidTicketId : '✓ Payment received — your ticket will appear here shortly, and we\'ve emailed your confirmation.')
    ),
    checkoutInfo&&checkoutInfo.status==='cancelled'&&React.createElement('div', { style:{ background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:0,padding:20,marginBottom:32,fontFamily:"'Space Grotesk',sans-serif",color:'#f59e0b' } },
      'Checkout was cancelled — no payment was taken. Head to Events to try again.'
    ),
    total===0
      ? React.createElement(FuturisticCard, { style:{ textAlign:'center' } },
          React.createElement('p', { style:{ fontFamily:"'Space Grotesk',sans-serif",color:'rgba(255,255,255,0.4)',fontSize:16 } },'No tickets yet. Head to Events to grab your spot.')
        )
      : React.createElement('div', { style:{ display:'flex',flexDirection:'column',gap:20 } },
          interests.map(i => React.createElement(WaitlistCard, { key:i.id, interest:i, onBuyNow:setBuyToken })),
          ticketGroups.map(group => React.createElement(TicketGroup, { key:group[0].orderId||group[0].id, tickets:group }))
        ),
    buyToken && React.createElement(InviteModal, { token:buyToken, onClose:()=>{ setBuyToken(null); reload(); } })
  );
}

/* ─── CONTACT ────────────────────────────────────────────────────── */
function PageContact({ user }) {
  const [name, setName] = useState(user?user.name:'');
  const [email, setEmail] = useState(user?user.email:'');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sponsors, setSponsors] = useState([]);

  useEffect(() => { window.RNTECH_API.getSponsors().then(setSponsors).catch(()=>{}); }, []);

  const inputStyle = { width:'100%',padding:'12px 16px',marginBottom:14,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:0,color:'#fff',fontSize:15,fontFamily:"'Space Grotesk',sans-serif",outline:'none',boxSizing:'border-box' };

  const send = async () => {
    setError('');
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (!message.trim()) { setError('Please enter a message.'); return; }
    setLoading(true);
    try {
      await window.RNTECH_API.submitMessage(name.trim(), email.trim(), message.trim());
      setSent(true);
    } catch(err) {
      setError(err.message || 'Failed to send — please try again.');
    } finally {
      setLoading(false);
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
      : React.createElement('div', null,
          React.createElement('input', { placeholder:'Your Name',value:name,onChange:e=>setName(e.target.value),style:inputStyle }),
          React.createElement('input', { type:'email',placeholder:'Email Address',value:email,onChange:e=>setEmail(e.target.value),style:inputStyle }),
          React.createElement('textarea', { placeholder:'Your message…',value:message,onChange:e=>setMessage(e.target.value),rows:6,style:{ ...inputStyle,resize:'vertical',marginBottom:20 } }),
          error&&React.createElement('div', { style:{ color:'#ef4444',fontSize:13,marginBottom:12,fontFamily:"'Space Grotesk',sans-serif" } }, error),
          React.createElement(GlowButton, { style:{ width:'100%' }, onClick:send, disabled:loading }, loading?'Sending…':'Send Message')
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

Object.assign(window, { PageHome, PageEvents, PageMixes, PageTickets, PageContact, OfferModal, InviteModal });
