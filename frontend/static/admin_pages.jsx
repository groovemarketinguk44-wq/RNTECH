// Admin Panel — full CRUD for events, mixes, tickets, campaigns, etc.
var { useState, useEffect, useRef } = React;

const ADMIN_TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'events',     label: 'Events' },
  { id: 'mixes',      label: 'Mixes' },
  { id: 'guestlist',  label: 'Guest List' },
  { id: 'waitlist',   label: 'Waitlist' },
  { id: 'attendees',  label: 'Attendees' },
  { id: 'messages',   label: 'Messages' },
  { id: 'campaigns',  label: 'Email Campaigns' },
  { id: 'inbox',      label: 'Inbox' },
  { id: 'sponsors',   label: 'Sponsors' },
];

// Pick the nearest upcoming event from a date-DESC list
function nextUpcomingId(events) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter(e => e.date >= today);
  if (upcoming.length) return upcoming[upcoming.length - 1].id; // last = closest date
  return events[0] ? events[0].id : '';
}

const FS = { fontFamily:"'Space Grotesk',sans-serif" };
const inputSt = { ...FS,width:'100%',padding:'10px 14px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:0,color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box',marginBottom:10 };
const labelSt = { ...FS,color:'rgba(255,255,255,0.5)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',display:'block',marginBottom:4 };

function AdminInput({ label, ...props }) {
  return React.createElement('div', { style:{marginBottom:14} },
    React.createElement('label', { style:labelSt }, label),
    React.createElement('input', { ...props, style:inputSt })
  );
}

function AdminTextarea({ label, rows=4, ...props }) {
  return React.createElement('div', { style:{marginBottom:14} },
    React.createElement('label', { style:labelSt }, label),
    React.createElement('textarea', { ...props, rows, style:{ ...inputSt, resize:'vertical', marginBottom:0 } })
  );
}

function AdminSelect({ label, options, ...props }) {
  return React.createElement('div', { style:{marginBottom:14} },
    React.createElement('label', { style:labelSt }, label),
    React.createElement('select', { ...props, style:{ ...inputSt,cursor:'pointer' } },
      options.map(o => React.createElement('option', { key:o.value,value:o.value,style:{background:'#040c18'} }, o.label))
    )
  );
}

function Modal({ title, onClose, children }) {
  const overlayRef = React.useRef(null);
  const sheetRef = React.useRef(null);
  const downOnOverlay = React.useRef(false);
  return React.createElement('div', { ref:overlayRef, className:'modal-overlay', style:{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20},
    onMouseDown:e=>{ downOnOverlay.current = (e.target===overlayRef.current); },
    onClick:e=>{ if(downOnOverlay.current && e.target===overlayRef.current) onClose(); downOnOverlay.current=false; }
  },
    React.createElement('div', { ref:sheetRef, className:'modal-sheet', onMouseDown:e=>e.stopPropagation(), onClick:e=>e.stopPropagation(), style:{background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',borderRadius:0,padding:32,width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 0 60px rgba(50,114,168,0.2)'} },
      React.createElement('div',{className:'modal-handle'}),
      React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24} },
        React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:20,color:'#fff',textTransform:'uppercase',margin:0} }, title),
        React.createElement('button', { onClick:onClose,style:{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:20,lineHeight:1} },'×')
      ),
      children
    )
  );
}

function StatCard({ label, value, color }) {
  return React.createElement('div', { style:{background:'rgba(4,12,28,0.82)',backdropFilter:'blur(10px)',padding:'20px 24px',border:'1px solid rgba(255,255,255,0.06)'} },
    React.createElement('div', { style:{...FS,color,fontSize:36,fontWeight:800} }, value),
    React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:11,letterSpacing:'0.12em',textTransform:'uppercase',marginTop:4} }, label)
  );
}

function TabBar({ tabs, active, onChange }) {
  return React.createElement('div', { style:{display:'flex',gap:8,marginBottom:32,flexWrap:'wrap',borderBottom:'1px solid rgba(255,255,255,0.08)',paddingBottom:0} },
    tabs.map(t => React.createElement('button', {
      key:t.id, onClick:()=>onChange(t.id),
      style:{...FS,padding:'10px 20px',border:'none',borderBottom:active===t.id?'2px solid #3272a8':'2px solid transparent',cursor:'pointer',fontWeight:700,fontSize:13,letterSpacing:'0.06em',textTransform:'uppercase',background:'transparent',color:active===t.id?'#3272a8':'rgba(255,255,255,0.45)',transition:'color 0.15s',marginBottom:-1}
    }, t.label + (t.badge?' ('+t.badge+')':'')))
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function TabOverview() {
  const [stats, setStats] = useState(null);
  useEffect(() => { window.RNTECH_API.getStats().then(setStats).catch(()=>{}); }, []);
  if (!stats) return React.createElement(Spinner);
  return React.createElement('div', null,
    React.createElement('div', { style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:16,marginBottom:40} },
      React.createElement(StatCard, { label:'Events', value:stats.events, color:'#3272a8' }),
      React.createElement(StatCard, { label:'Tickets Issued', value:stats.tickets, color:'#10b981' }),
      React.createElement(StatCard, { label:'Members', value:stats.users, color:'#06b6d4' }),
      React.createElement(StatCard, { label:'Unread Messages', value:stats.messages, color:'#f59e0b' }),
      React.createElement(StatCard, { label:'Active Mixes', value:stats.mixes, color:'#9f84b2' }),
      React.createElement(StatCard, { label:'Email Subscribers', value:stats.subscribers, color:'#10b981' }),
    ),
    React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)',fontSize:13} },
      'Use the tabs above to manage events, mixes, tickets, attendees, and email campaigns.')
  );
}

// ── Events ────────────────────────────────────────────────────────────────────
function TabEvents() {
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'',date:'',displayDate:'',startTime:'',endTime:'',venue:'',location:'',description:'',lineup:'',giveaways:'',status:'upcoming',isFree:true,featured:false,registrationMode:'open' });
  const [saving, setSaving] = useState(false);
  const [posterFile, setPosterFile] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [ttForm, setTtForm] = useState({ name:'',pricePounds:'0',capacity:100,description:'',active:true,isTiered:false,tiers:[{capacity:100,pricePounds:'0'}] });
  const [editingTt, setEditingTt] = useState(null);

  const load = () => window.RNTECH_API.getEvents().then(setEvents).catch(()=>{});
  useEffect(()=>{ load(); },[]);

  const openNew = () => {
    setEditing(null);
    setForm({ title:'',date:'',displayDate:'',startTime:'',endTime:'',venue:'The White Swan',location:'St Albans, Hertfordshire',description:'',lineup:'',giveaways:'',status:'upcoming',isFree:true,featured:false,registrationMode:'open' });
    setPosterFile(null);
    setShowForm(true);
  };

  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      title:ev.title, date:ev.date, displayDate:ev.displayDate,
      startTime:ev.startTime, endTime:ev.endTime||'', venue:ev.venue, location:ev.location,
      description:ev.description||'',
      lineup:(ev.lineup||[]).map(l=>l.name+(l.role?':'+l.role:'')).join('\n'),
      giveaways:(ev.giveaways||[]).join('\n'),
      status:ev.status, isFree:ev.isFree, featured:ev.featured,
      registrationMode:ev.registrationMode||'open',
    });
    setPosterFile(null);
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const lineup = form.lineup.split('\n').filter(Boolean).map(l=>{
      const [name,...rest]=l.split(':');
      return { name:name.trim(), role:rest.join(':').trim()||'Support' };
    });
    const giveaways = form.giveaways.split('\n').filter(Boolean).map(g=>g.trim());
    const payload = { ...form, lineup, giveaways };
    try {
      let ev;
      if (editing) ev = await window.RNTECH_API.updateEvent(editing.id, payload);
      else ev = await window.RNTECH_API.createEvent(payload);
      if (posterFile) await window.RNTECH_API.uploadPoster(ev.id, posterFile);
      setShowForm(false);
      load();
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this event? This will also delete all ticket types.')) return;
    await window.RNTECH_API.deleteEvent(id).catch(err=>alert(err.message));
    load();
  };

  const blankTtForm = () => ({ name:'',pricePounds:'0',capacity:100,description:'',active:true,isTiered:false,tiers:[{capacity:100,pricePounds:'0'}] });

  const openTicketTypes = async (ev) => {
    setSelectedEvent(ev);
    const data = await window.RNTECH_API.getEvent(ev.id).catch(()=>({ ticketTypes:[] }));
    setTicketTypes(data.ticketTypes||[]);
    setTtForm(blankTtForm()); setEditingTt(null);
  };

  const openEditTt = (tt) => {
    setEditingTt(tt);
    setTtForm({
      name: tt.name,
      pricePounds: tt.isTiered ? '0' : (tt.price/100).toFixed(2),
      capacity: tt.capacity,
      description: tt.description||'',
      active: tt.active,
      isTiered: tt.isTiered||false,
      tiers: tt.isTiered && tt.tiers && tt.tiers.length
        ? tt.tiers.map(t=>({ capacity:t.capacity, pricePounds:(t.price_pence/100).toFixed(2) }))
        : [{capacity:100,pricePounds:'0'}],
    });
  };

  const buildTtPayload = () => {
    const base = { eventId: selectedEvent.id, name: ttForm.name, description: ttForm.description, active: ttForm.active };
    if (ttForm.isTiered) {
      return { ...base, isTiered:true, tiers: ttForm.tiers.map(t=>({ capacity:parseInt(t.capacity)||0, price_pence:Math.round(parseFloat(t.pricePounds||0)*100) })), price:0, capacity:0 };
    }
    return { ...base, isTiered:false, tiers:[], price:Math.round(parseFloat(ttForm.pricePounds||0)*100), capacity:parseInt(ttForm.capacity)||100 };
  };

  const saveTicketType = async (e) => {
    e.preventDefault();
    const payload = buildTtPayload();
    if (editingTt) {
      await window.RNTECH_API.updateTicketType(editingTt.id, payload).catch(err=>alert(err.message));
    } else {
      await window.RNTECH_API.createTicketType(payload).catch(err=>alert(err.message));
    }
    const data = await window.RNTECH_API.getEvent(selectedEvent.id).catch(()=>({ ticketTypes:[] }));
    setTicketTypes(data.ticketTypes||[]);
    setTtForm(blankTtForm()); setEditingTt(null);
  };

  const delTicketType = async (id) => {
    if (!confirm('Delete this ticket type?')) return;
    await window.RNTECH_API.deleteTicketType(id).catch(err=>alert(err.message));
    const data = await window.RNTECH_API.getEvent(selectedEvent.id).catch(()=>({ ticketTypes:[] }));
    setTicketTypes(data.ticketTypes||[]);
    if (editingTt && editingTt.id===id) { setEditingTt(null); setTtForm(blankTtForm()); }
  };

  return React.createElement('div', null,
    React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20} },
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:14} }, events.length+' events'),
      React.createElement(GlowButton, { small:true, onClick:openNew }, '+ New Event')
    ),
    React.createElement('div', { style:{display:'flex',flexDirection:'column',gap:12} },
      events.map(ev=>React.createElement('div', { key:ev.id, style:{background:'rgba(5,18,44,0.92)',border:'1px solid rgba(50,114,168,0.2)',padding:'18px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12} },
        React.createElement('div', null,
          React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:16,color:'#fff',margin:'0 0 4px',textTransform:'uppercase'} }, ev.title),
          React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13} }, ev.displayDate+' · '+ev.venue),
          React.createElement('div', { style:{marginTop:6,display:'flex',gap:6} },
            React.createElement(Chip, { label:ev.status, color:ev.status==='upcoming'?'#3272a8':'#64748b' }),
            ev.isFree&&React.createElement(Chip, { label:'Free', color:'#10b981' }),
            ev.featured&&React.createElement(Chip, { label:'Featured', color:'#f59e0b' })
          )
        ),
        React.createElement('div', { style:{display:'flex',gap:8,flexWrap:'wrap'} },
          React.createElement(GlowButton, { small:true,variant:'ghost',onClick:()=>openTicketTypes(ev) },'Ticket Types'),
          React.createElement(GlowButton, { small:true,variant:'ghost',onClick:()=>openEdit(ev) },'Edit'),
          React.createElement(GlowButton, { small:true,variant:'danger',onClick:()=>del(ev.id) },'Delete')
        )
      ))
    ),
    showForm&&React.createElement(Modal, { title:editing?'Edit Event':'New Event', onClose:()=>setShowForm(false) },
      React.createElement('form', { onSubmit:save },
        React.createElement(AdminInput, { label:'Title',value:form.title,onChange:e=>setForm(f=>({...f,title:e.target.value})),required:true }),
        React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12} },
          React.createElement(AdminInput, { label:'Date',value:form.date,onChange:e=>setForm(f=>({...f,date:e.target.value,displayDate:f.displayDate||e.target.value})),placeholder:'TBC or 2025-05-25' }),
          React.createElement(AdminInput, { label:'Display Date (shown to users)',value:form.displayDate,onChange:e=>setForm(f=>({...f,displayDate:e.target.value})),placeholder:'TBC · Summer 2026' })
        ),
        React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12} },
          React.createElement(AdminInput, { label:'Start Time',value:form.startTime,onChange:e=>setForm(f=>({...f,startTime:e.target.value})),placeholder:'2:00 PM' }),
          React.createElement(AdminInput, { label:'End Time',value:form.endTime,onChange:e=>setForm(f=>({...f,endTime:e.target.value})),placeholder:'11:00 PM' })
        ),
        React.createElement(AdminInput, { label:'Venue',value:form.venue,onChange:e=>setForm(f=>({...f,venue:e.target.value})) }),
        React.createElement(AdminInput, { label:'Location',value:form.location,onChange:e=>setForm(f=>({...f,location:e.target.value})) }),
        React.createElement(AdminTextarea, { label:'Description',value:form.description,onChange:e=>setForm(f=>({...f,description:e.target.value})),rows:3 }),
        React.createElement(AdminTextarea, { label:'Lineup (one per line: NAME:Role)',value:form.lineup,onChange:e=>setForm(f=>({...f,lineup:e.target.value})),rows:4,placeholder:'DJ MIDDO:Headliner\nBEN HENDERSON:Headliner\nDJ DAGZ:Support' }),
        React.createElement(AdminTextarea, { label:'Giveaways (one per line)',value:form.giveaways,onChange:e=>setForm(f=>({...f,giveaways:e.target.value})),rows:3,placeholder:'Free entry all night\nBrewtini sampling' }),
        React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14} },
          React.createElement(AdminSelect, { label:'Status',value:form.status,onChange:e=>setForm(f=>({...f,status:e.target.value})),options:[{value:'upcoming',label:'Upcoming'},{value:'past',label:'Past'}] }),
          React.createElement(AdminSelect, { label:'Registration Mode',value:form.registrationMode,onChange:e=>setForm(f=>({...f,registrationMode:e.target.value})),options:[{value:'open',label:'Open — anyone can get tickets'},{value:'interest',label:'Interest Only — waitlist, admin picks'},{value:'closed',label:'Closed — no registration'}] })
        ),
        React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14} },
          React.createElement('div', null,
            React.createElement('label', { style:labelSt },'Free Entry'),
            React.createElement('div', { style:{display:'flex',gap:8,paddingTop:4} },
              ['Yes','No'].map(v=>React.createElement('label', { key:v,style:{...FS,color:'rgba(255,255,255,0.7)',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:4} },
                React.createElement('input', { type:'radio',name:'isFree',value:v==='Yes',checked:(form.isFree===(v==='Yes')),onChange:()=>setForm(f=>({...f,isFree:v==='Yes'})),style:{accentColor:'#3272a8'} }),v
              ))
            )
          ),
          React.createElement('div', null,
            React.createElement('label', { style:labelSt },'Featured'),
            React.createElement('div', { style:{display:'flex',gap:8,paddingTop:4} },
              ['Yes','No'].map(v=>React.createElement('label', { key:v,style:{...FS,color:'rgba(255,255,255,0.7)',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:4} },
                React.createElement('input', { type:'radio',name:'featured',value:v==='Yes',checked:(form.featured===(v==='Yes')),onChange:()=>setForm(f=>({...f,featured:v==='Yes'})),style:{accentColor:'#3272a8'} }),v
              ))
            )
          )
        ),
        React.createElement('div', { style:{marginBottom:20} },
          React.createElement('label', { style:labelSt },'Poster Image'),
          editing&&editing.posterImage&&React.createElement('div', { style:{display:'flex',alignItems:'center',gap:12,marginBottom:10} },
            React.createElement('img', { src:editing.posterImage,alt:'Current poster',style:{width:64,height:64,objectFit:'cover',borderRadius:4,border:'1px solid rgba(50,114,168,0.3)'} }),
            React.createElement('div', null,
              React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:12,marginBottom:6} },'Current poster'),
              React.createElement('button', { type:'button',onClick:async()=>{ if(!confirm('Remove poster image?')) return; await window.RNTECH_API.removePoster(editing.id); setEditing(ev=>({...ev,posterImage:null})); },style:{...FS,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} },'Remove Image')
            )
          ),
          React.createElement('input', { type:'file',accept:'image/*',onChange:e=>setPosterFile(e.target.files[0]),style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:13} })
        ),
        React.createElement(GlowButton, { type:'submit',style:{width:'100%'},disabled:saving }, saving?'Saving…':editing?'Update Event':'Create Event')
      )
    ),
    // Ticket Types modal
    selectedEvent&&React.createElement(Modal, { title:'Ticket Types — '+selectedEvent.title, onClose:()=>{ setSelectedEvent(null); setEditingTt(null); } },
      ticketTypes.length>0&&React.createElement('div', { style:{marginBottom:20} },
        ticketTypes.map(tt=>React.createElement('div', { key:tt.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',background:editingTt&&editingTt.id===tt.id?'rgba(50,114,168,0.08)':'transparent'} },
          React.createElement('div', null,
            React.createElement('div', { style:{...FS,color:'#fff',fontWeight:700,fontSize:14} }, tt.name),
            React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:12} },
              (tt.isTiered
                ? 'Tiered · '+tt.tiers.map((t,i)=>'T'+(i+1)+': £'+(t.price_pence/100).toFixed(2)).join(' → ')
                : (tt.price===0?'FREE':'£'+(tt.price/100).toFixed(2))
              )+' · '+tt.soldCount+'/'+tt.capacity+' sold'
            )
          ),
          React.createElement('div', { style:{display:'flex',gap:6} },
            React.createElement(GlowButton, { small:true,variant:'ghost',onClick:()=>openEditTt(tt) },'Edit'),
            React.createElement(GlowButton, { small:true,variant:'danger',onClick:()=>delTicketType(tt.id) },'Remove')
          )
        ))
      ),
      React.createElement('form', { onSubmit:saveTicketType },
        React.createElement('h4', { style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:12,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:16,marginTop:ticketTypes.length>0?24:0} },
          editingTt ? 'Editing: '+editingTt.name : 'Add Ticket Type'
        ),
        React.createElement(AdminInput, { label:'Name',value:ttForm.name,onChange:e=>setTtForm(f=>({...f,name:e.target.value})),placeholder:'General Entry',required:true }),
        // Tiered toggle
        React.createElement('div', { style:{display:'flex',alignItems:'center',gap:10,marginBottom:14} },
          React.createElement('input', { type:'checkbox',id:'isTiered',checked:ttForm.isTiered,onChange:e=>setTtForm(f=>({...f,isTiered:e.target.checked})),style:{cursor:'pointer',width:16,height:16} }),
          React.createElement('label', { htmlFor:'isTiered',style:{...FS,color:'rgba(255,255,255,0.7)',fontSize:13,cursor:'pointer'} },'Tiered pricing (e.g. early bird → standard)')
        ),
        // Flat price + capacity
        !ttForm.isTiered&&React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12} },
          React.createElement(AdminInput, { label:'Price (£, 0 = free)',type:'number',step:'0.01',min:'0',value:ttForm.pricePounds,onChange:e=>setTtForm(f=>({...f,pricePounds:e.target.value})) }),
          React.createElement(AdminInput, { label:'Capacity',type:'number',value:ttForm.capacity,onChange:e=>setTtForm(f=>({...f,capacity:parseInt(e.target.value)||100})),min:1 })
        ),
        // Tiered rows
        ttForm.isTiered&&React.createElement('div', { style:{marginBottom:14} },
          React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8} },'Tiers'),
          ttForm.tiers.map((tier,i)=>React.createElement('div', { key:i,style:{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,marginBottom:8,alignItems:'center'} },
            React.createElement('input', { type:'number',min:'1',placeholder:'Capacity',value:tier.capacity,onChange:e=>setTtForm(f=>({ ...f,tiers:f.tiers.map((t,j)=>j===i?{...t,capacity:parseInt(e.target.value)||0}:t) })),style:{...inputSt,marginBottom:0} }),
            React.createElement('input', { type:'number',min:'0',step:'0.01',placeholder:'£ price',value:tier.pricePounds,onChange:e=>setTtForm(f=>({ ...f,tiers:f.tiers.map((t,j)=>j===i?{...t,pricePounds:e.target.value}:t) })),style:{...inputSt,marginBottom:0} }),
            ttForm.tiers.length>1&&React.createElement('button', { type:'button',onClick:()=>setTtForm(f=>({...f,tiers:f.tiers.filter((_,j)=>j!==i)})),style:{...FS,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',padding:'8px 10px',fontSize:12,fontWeight:700} },'✕')
          )),
          React.createElement('button', { type:'button',onClick:()=>setTtForm(f=>({...f,tiers:[...f.tiers,{capacity:100,pricePounds:'0'}]})),style:{...FS,background:'rgba(50,114,168,0.1)',border:'1px solid rgba(50,114,168,0.3)',color:'#3272a8',cursor:'pointer',padding:'6px 14px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} },'+ Add Tier')
        ),
        React.createElement(AdminInput, { label:'Description (optional)',value:ttForm.description,onChange:e=>setTtForm(f=>({...f,description:e.target.value})) }),
        React.createElement('div', { style:{display:'flex',gap:8} },
          React.createElement(GlowButton, { type:'submit',style:{flex:1} }, editingTt ? 'Save Changes' : 'Add Ticket Type'),
          editingTt&&React.createElement(GlowButton, { type:'button',variant:'ghost',onClick:()=>{ setEditingTt(null); setTtForm(blankTtForm()); } },'Cancel')
        )
      )
    )
  );
}

// ── Mixes ─────────────────────────────────────────────────────────────────────
function TabMixes() {
  const [mixes, setMixes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'',residentName:'',month:'',duration:'',description:'',tracklist:'',active:true,videoUrl:'' });
  const [saving, setSaving] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [uploading, setUploading] = useState(null);

  const load = () => window.RNTECH_API.adminGetMixes().then(setMixes).catch(()=>{});
  useEffect(()=>{ load(); },[]);

  const openNew = () => {
    setEditing(null);
    setForm({ title:'',residentName:'',month:'',duration:'',description:'',tracklist:'',active:true,videoUrl:'' });
    setVideoFile(null); setCoverFile(null);
    setShowForm(true);
  };

  const openEdit = (mix) => {
    setEditing(mix);
    setForm({ title:mix.title,residentName:mix.residentName,month:mix.month,duration:mix.duration,description:mix.description||'',tracklist:(mix.tracklist||[]).join('\n'),active:mix.active,videoUrl:mix.videoSrc&&!mix.videoSrc.startsWith('/uploads/')?mix.videoSrc:'' });
    setVideoFile(null); setCoverFile(null);
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, tracklist:form.tracklist.split('\n').filter(Boolean).map(t=>t.trim()) };
    try {
      let mix;
      if (editing) mix = await window.RNTECH_API.updateMix(editing.id, payload);
      else mix = await window.RNTECH_API.createMix(payload);
      if (videoFile) { setUploading('video'); await window.RNTECH_API.uploadVideo(mix.id, videoFile); }
      if (coverFile) { setUploading('cover'); await window.RNTECH_API.uploadCover(mix.id, coverFile); }
      setShowForm(false); setUploading(null);
      load();
    } catch(err) { alert(err.message); }
    finally { setSaving(false); setUploading(null); }
  };

  const del = async (id) => {
    if (!confirm('Delete this mix?')) return;
    await window.RNTECH_API.deleteMix(id).catch(err=>alert(err.message));
    load();
  };

  return React.createElement('div', null,
    React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20} },
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:14} }, mixes.length+' mixes'),
      React.createElement(GlowButton, { small:true, onClick:openNew },'+ New Mix')
    ),
    React.createElement('div', { style:{display:'flex',flexDirection:'column',gap:12} },
      mixes.map(mix=>React.createElement('div', { key:mix.id, style:{background:'rgba(5,18,44,0.92)',border:'1px solid rgba(50,114,168,0.2)',padding:'18px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12} },
        React.createElement('div', { style:{display:'flex',gap:14,alignItems:'center'} },
          mix.coverImage&&React.createElement('img', { src:mix.coverImage,alt:'',style:{width:48,height:48,objectFit:'cover',borderRadius:4,flexShrink:0} }),
          React.createElement('div', null,
            React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:15,color:'#fff',margin:'0 0 2px',textTransform:'uppercase'} }, mix.title),
            React.createElement('div', { style:{...FS,color:'#3272a8',fontSize:12} }, mix.residentName+' · '+mix.month),
            React.createElement('div', { style:{display:'flex',gap:6,marginTop:6} },
              React.createElement(Chip, { label:mix.active?'Active':'Hidden', color:mix.active?'#10b981':'#64748b' }),
              mix.hasVideo&&React.createElement(Chip, { label:'Has Video', color:'#06b6d4' })
            )
          )
        ),
        React.createElement('div', { style:{display:'flex',gap:8} },
          React.createElement(GlowButton, { small:true,variant:'ghost',onClick:()=>openEdit(mix) },'Edit'),
          React.createElement(GlowButton, { small:true,variant:'danger',onClick:()=>del(mix.id) },'Delete')
        )
      ))
    ),
    showForm&&React.createElement(Modal, { title:editing?'Edit Mix':'New Mix', onClose:()=>setShowForm(false) },
      React.createElement('form', { onSubmit:save },
        React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12} },
          React.createElement(AdminInput, { label:'Title',value:form.title,onChange:e=>setForm(f=>({...f,title:e.target.value})),required:true }),
          React.createElement(AdminInput, { label:'Resident / DJ Name',value:form.residentName,onChange:e=>setForm(f=>({...f,residentName:e.target.value})),required:true })
        ),
        React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12} },
          React.createElement(AdminInput, { label:'Month (e.g. May 2025)',value:form.month,onChange:e=>setForm(f=>({...f,month:e.target.value})) }),
          React.createElement(AdminInput, { label:'Duration (e.g. 60 MIN)',value:form.duration,onChange:e=>setForm(f=>({...f,duration:e.target.value})) })
        ),
        React.createElement(AdminTextarea, { label:'Description',value:form.description,onChange:e=>setForm(f=>({...f,description:e.target.value})),rows:3 }),
        React.createElement(AdminTextarea, { label:'Tracklist (one per line)',value:form.tracklist,onChange:e=>setForm(f=>({...f,tracklist:e.target.value})),rows:5,placeholder:'01. Opening Vibes\n02. RnB Selections...' }),
        React.createElement(AdminInput, { label:'External Video URL (YouTube/Vimeo embed or direct MP4)',value:form.videoUrl,onChange:e=>setForm(f=>({...f,videoUrl:e.target.value})),placeholder:'https://...' }),
        React.createElement('div', { style:{marginBottom:12} },
          React.createElement('label', { style:labelSt },'Upload Video File (MP4) — overrides URL above'),
          React.createElement('input', { type:'file',accept:'video/*',onChange:e=>setVideoFile(e.target.files[0]),style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:13} })
        ),
        React.createElement('div', { style:{marginBottom:20} },
          React.createElement('label', { style:labelSt },'Cover Image'),
          React.createElement('input', { type:'file',accept:'image/*',onChange:e=>setCoverFile(e.target.files[0]),style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:13} })
        ),
        React.createElement('div', { style:{display:'flex',gap:12,alignItems:'center',marginBottom:20} },
          React.createElement('label', { style:{...FS,color:'rgba(255,255,255,0.7)',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:8} },
            React.createElement('input', { type:'checkbox',checked:form.active,onChange:e=>setForm(f=>({...f,active:e.target.checked})),style:{accentColor:'#3272a8',width:16,height:16} }),
            'Active (visible on site)'
          )
        ),
        uploading&&React.createElement('div', { style:{...FS,color:'#3272a8',fontSize:13,marginBottom:12} },'Uploading '+uploading+', please wait…'),
        React.createElement(GlowButton, { type:'submit',style:{width:'100%'},disabled:saving }, saving?'Saving…':editing?'Update Mix':'Create Mix')
      )
    )
  );
}

// ── QR Scanner Modal ──────────────────────────────────────────────────────────
function QRScanModal({ onClose, onScan }) {
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const scanCanvasRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const doneRef = React.useRef(false);
  const [error, setError] = React.useState('');
  const [scanning, setScanning] = React.useState(false);

  React.useEffect(() => {
    if (typeof jsQR === 'undefined') { setError('QR scanner library not loaded.'); return; }

    // Hidden canvas used only for jsQR — smaller = faster detection
    const scanCanvas = document.createElement('canvas');
    scanCanvasRef.current = scanCanvas;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } } })
      .then(stream => {
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.play().then(() => {
          setScanning(true);
          tick();
        });
      })
      .catch(err => setError('Camera denied or unavailable: ' + err.message));

    function tick() {
      if (doneRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const scanCanvas = scanCanvasRef.current;
      if (!video || !canvas || !scanCanvas) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;

        // Draw full res to preview canvas
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);

        // Downscale to 640px wide for jsQR — much faster
        const scale = Math.min(1, 640 / w);
        const sw = Math.floor(w * scale);
        const sh = Math.floor(h * scale);
        scanCanvas.width = sw;
        scanCanvas.height = sh;
        const sctx = scanCanvas.getContext('2d');
        sctx.drawImage(video, 0, 0, sw, sh);
        const imageData = sctx.getImageData(0, 0, sw, sh);
        const code = jsQR(imageData.data, sw, sh, { inversionAttempts: 'dontInvert' });
        if (code && code.data && code.data.trim().length >= 4) {
          doneRef.current = true;
          stopStream();
          onScan(code.data.trim());
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function stopStream() {
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    }

    return () => { doneRef.current = true; stopStream(); };
  }, []);

  const overlayStyle = { position:'fixed',inset:0,zIndex:600,background:'#000',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',padding:'16px 0 24px',overflowY:'auto' };
  return React.createElement('div', { style:overlayStyle },
    React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:18,color:'#fff',margin:'0 0 12px',textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Scan Ticket QR'),
    React.createElement('video', { ref:videoRef, style:{position:'absolute',opacity:0,width:1,height:1,pointerEvents:'none'}, playsInline:true, autoPlay:true, muted:true }),
    React.createElement('canvas', { ref:canvasRef, style:{width:'100%',maxWidth:500,aspectRatio:'1/1',display:'block',border:'2px solid rgba(50,114,168,0.6)',background:'#000'} }),
    error && React.createElement('p', { style:{...FS,color:'#ef4444',fontSize:13,marginTop:16,textAlign:'center',maxWidth:300} }, error),
    !scanning && !error && React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13,marginTop:16} }, 'Starting camera…'),
    scanning && !error && React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13,marginTop:16} }, 'Point at QR code on ticket'),
    React.createElement('div', { style:{marginTop:20} },
      React.createElement(GlowButton, {
        onClick:()=>{
          doneRef.current = true;
          cancelAnimationFrame(rafRef.current);
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
          onClose();
        }, variant:'ghost' }, 'Cancel')
    )
  );
}

// ── Gender guesser ───────────────────────────────────────────────────────────
const FEMALE_NAMES = new Set(['aaliyah','abbie','abby','abigail','ada','adaeze','adaora','addison','adelaide','adele','adeline','adriana','agnes','aisha','aishwarya','alex','alexa','alexandra','alexia','alexis','alice','alicia','alina','alisa','alisha','alison','alissa','aliya','aliyah','allegra','allie','allison','alondra','althea','alyana','alycia','alysha','alysia','alyson','alyssa','amalia','amanda','amara','amaya','amber','amelia','amelie','ami','amia','amie','amina','amira','amiya','amy','ana','anais','anastasia','andrea','angel','angela','angelica','angelina','angie','anika','anita','ann','anna','annabelle','anne','annie','annika','anushka','aoife','april','arabella','aria','ariana','arianna','ariel','arielle','arya','ashley','asia','astrid','aubrey','audrey','aurora','autumn','ava','ayasha','ayesha','aysha','bea','beatrice','beatrix','bella','bethany','bettina','bianca','billie','bonnie','brenda','brianna','bridget','brooke','brooklyn','caitlin','caitlyn','callie','camilla','camille','cara','carina','carla','carmen','carol','carolina','caroline','cassandra','cassidy','cassie','cecelia','cecilia','celine','charlotte','chelsea','cheryl','chloe','christa','christina','christine','ciara','claire','clara','claudia','clementine','cleo','colette','connie','constance','cora','corinne','courtney','crystal','daisy','dana','danielle','dani','daphne','daria','darla','davina','dawn','debbie','deborah','deja','demi','denise','destiny','diana','dina','dominique','donna','dora','dorothy','dulce','ebony','eden','eleanor','elena','eli','eliana','elisa','elise','elisha','elissa','eliza','elizabeth','ella','elle','ellie','elsa','elsie','emilia','emilie','emily','emma','emmeline','erica','erin','esme','estelle','esther','eva','evelyn','evie','faith','fatima','faye','felicia','felicity','fern','fiona','fleur','florence','francesca','freya','gabriela','gabriella','gabrielle','gemma','georgia','georgie','gianna','gillian','giselle','grace','gracie','hailey','hana','hannah','harper','harriet','hattie','hayley','hazel','heather','helen','helena','hollie','holly','imogen','india','indigo','ingrid','iris','isabella','isabelle','isadora','isla','ivy','jade','jada','jaida','jamie','jasmine','jemima','jenna','jennifer','jessica','jessie','jill','joanna','jodie','jordan','josie','julia','juliet','juliette','june','kaitlin','kaitlyn','karen','karina','kate','katelyn','katherine','kathleen','katie','katrina','katy','kayla','kaylee','keira','kerry','kezia','khloe','kiera','kim','kimberley','kimberly','kylie','lacey','laila','lara','laura','lauren','layla','leah','leila','leonie','lexi','lia','libby','lily','lina','linda','lisa','lola','london','lottie','louisa','louise','lucia','lucy','luna','lydia','mackenzie','madeline','madelyn','madison','mae','maeve','maggie','maisie','malia','mandy','maria','mariam','marina','mary','matilda','maya','megan','melissa','mia','micaela','michaela','michelle','millie','miranda','mollie','molly','morgan','nadia','naomi','natalia','natalie','natasha','niamh','nicole','nina','nora','olivia','paige','paris','phoebe','pippa','poppy','priya','rachel','rebecca','robyn','rosa','rose','rosie','ruby','ruth','sadie','sahara','sam','samantha','sara','sarah','savannah','scarlett','serena','shannon','sharon','sienna','simone','sky','skye','skylar','sofia','sonia','sophia','sophie','stacey','stella','stephanie','summer','susan','talia','tamara','tamsin','tanya','tara','tasha','tayler','taylor','tegan','thea','tia','tiffany','tori','tracy','uma','valentina','vanessa','veronica','victoria','violet','vivian','wendy','willow','yasmin','zara','zoe','zoey']);
const MALE_NAMES = new Set(['aaron','adam','adebayo','adeel','adewale','aj','alan','alex','alexander','alexis','alf','alfie','ali','amir','andrew','andy','angel','anthony','antonio','archie','arthur','ash','ashton','austin','axel','ayaan','ayden','bailey','barnaby','barry','bastian','ben','benjamin','blake','bradley','brandon','brendan','brian','brodie','brooks','bryan','caleb','callum','cameron','carl','carlos','chad','charlie','chris','christian','christopher','claude','cody','cole','colin','conor','cooper','corey','craig','dale','damian','dan','daniel','danny','darren','david','dean','declan','dennis','derek','devin','dominic','dylan','ed','eddie','edward','eli','elijah','ellis','emre','eric','ethan','evan','felix','finley','finn','frankie','fraser','fred','freddie','gabriel','gary','gavin','george','gideon','glen','graham','grant','greg','harry','harvey','hayden','henry','hugo','hunter','iain','ibrahim','isaiah','jack','jacob','jake','james','jamie','jasper','jay','jayden','jenson','joe','joel','john','jonathan','jordan','joseph','josh','joshua','julian','kai','keanu','keiran','keith','kieran','kyle','lachlan','lance','lee','leon','levi','lewis','liam','logan','louie','louis','luca','lucas','luke','marcus','mario','mark','martin','mason','matt','matthew','max','michael','miguel','miles','mitchell','mo','mohammed','morgan','nathan','neil','niall','nicholas','nick','noel','noah','oliver','omar','oscar','owen','patrick','paul','pedro','peter','philip','rhys','richard','riley','rob','robert','robin','rory','ross','ryan','sam','samuel','scott','sean','sebastian','seth','simon','spencer','stanley','stefan','stephen','steve','steven','taylor','theo','thomas','tim','todd','tom','tommy','tony','toby','travis','trevor','tristan','tyler','tyler','umar','victor','vincent','will','william','xander','xavier','zac','zach','zachary','zak']);

const GENDER_STORAGE_KEY = 'rntech_gender_overrides';

function loadGenderOverrides() {
  try { return JSON.parse(localStorage.getItem(GENDER_STORAGE_KEY) || '{}'); } catch { return {}; }
}

function guessGender(fullName, overrides) {
  const first = (fullName || '').trim().split(/\s+/)[0].toLowerCase();
  if (overrides && overrides[first]) return overrides[first];
  if (FEMALE_NAMES.has(first)) return 'f';
  if (MALE_NAMES.has(first)) return 'm';
  return '?';
}

function GenderCounter({ tickets, overrides, onClickUnknown }) {
  const counts = { m: 0, f: 0, '?': 0 };
  (tickets || []).forEach(t => { counts[guessGender(t.holderName, overrides)]++; });
  const pill = (label, count, color, onClick) =>
    React.createElement('span', {
      onClick,
      style:{...FS,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:2,padding:'3px 10px',fontSize:12,fontWeight:700,color,letterSpacing:'0.05em',cursor:onClick?'pointer':'default',userSelect:'none'}
    }, label + ' ' + count);
  return React.createElement('div', { style:{display:'flex',gap:6,alignItems:'center'} },
    pill('♀', counts.f, '#f472b6'),
    pill('♂', counts.m, '#60a5fa'),
    counts['?'] > 0 && pill('?', counts['?'], 'rgba(255,255,255,0.5)', onClickUnknown)
  );
}

function GenderResolveModal({ tickets, overrides, onSave, onClose }) {
  const unknowns = (tickets || []).filter(t => guessGender(t.holderName, overrides) === '?');
  const [idx, setIdx] = useState(0);
  const current = unknowns[idx];

  const backdropSt = { position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:9999, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'80px 20px 20px' };
  const boxSt = { background:'#0d1829', border:'2px solid rgba(50,114,168,0.6)', padding:'32px 24px', textAlign:'center', width:'100%', maxWidth:'320px', borderRadius:'4px' };

  const pick = (gender) => {
    if (!current) return;
    const key = current.holderName.trim().split(/\s+/)[0].toLowerCase();
    const updated = { ...overrides, [key]: gender };
    localStorage.setItem(GENDER_STORAGE_KEY, JSON.stringify(updated));
    onSave(updated);
    setIdx(i => i + 1);
  };

  return React.createElement('div', { style:backdropSt, onTouchEnd:e=>{ if(e.target===e.currentTarget) onClose(); }, onClick:e=>{ if(e.target===e.currentTarget) onClose(); } },
    React.createElement('div', { style:boxSt },
      !current
        ? React.createElement(React.Fragment, null,
            React.createElement('p', { style:{...FS,color:'#10b981',fontSize:20,fontWeight:800,marginBottom:24} }, 'All done!'),
            React.createElement('button', { onClick:onClose, style:{...FS,background:'rgba(50,114,168,0.2)',border:'1px solid rgba(50,114,168,0.5)',color:'#fff',padding:'10px 28px',cursor:'pointer',fontSize:14,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase'} }, 'Close')
          )
        : React.createElement(React.Fragment, null,
            React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)',fontSize:11,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:10} }, (idx+1)+' of '+unknowns.length+' unknown'),
            React.createElement('p', { style:{...FS,color:'#fff',fontSize:30,fontWeight:800,marginBottom:4,textTransform:'uppercase'} }, current.holderName.trim().split(/\s+/)[0]),
            React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)',fontSize:13,marginBottom:28} }, current.holderName),
            React.createElement('div', { style:{display:'flex',gap:10,justifyContent:'center',marginBottom:20} },
              React.createElement('button', { onClick:()=>pick('f'), style:{...FS,background:'rgba(244,114,182,0.15)',border:'2px solid #f472b6',color:'#f472b6',fontSize:18,fontWeight:800,padding:'14px 28px',cursor:'pointer',borderRadius:'2px'} }, '♀ Girl'),
              React.createElement('button', { onClick:()=>pick('m'), style:{...FS,background:'rgba(96,165,250,0.15)',border:'2px solid #60a5fa',color:'#60a5fa',fontSize:18,fontWeight:800,padding:'14px 28px',cursor:'pointer',borderRadius:'2px'} }, '♂ Boy')
            ),
            React.createElement('button', { onClick:onClose, style:{...FS,background:'none',border:'none',color:'rgba(255,255,255,0.25)',fontSize:12,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em'} }, 'Cancel')
          )
    )
  );
}

// ── Guest List ────────────────────────────────────────────────────────────────
function TabGuestList() {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestTypeId, setGuestTypeId] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [genderOverrides, setGenderOverrides] = useState(loadGenderOverrides);
  const [showGenderResolve, setShowGenderResolve] = useState(false);

  useEffect(() => {
    window.RNTECH_API.getEvents().then(ev=>{ setEvents(ev); if(ev.length) setSelectedId(nextUpcomingId(ev)); }).catch(()=>{});
  },[]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    window.RNTECH_API.adminTickets(selectedId).then(t=>{ setTickets(t); setLoading(false); }).catch(()=>setLoading(false));
  },[selectedId]);

  const reload = () => window.RNTECH_API.adminTickets(selectedId).then(setTickets).catch(()=>{});

  const updateStatus = async (ticketId, status) => {
    await window.RNTECH_API.updateTicketStatus(ticketId, status).catch(err=>alert(err.message));
    reload();
  };

  const addGuest = async () => {
    if (!guestName.trim() || !guestEmail.trim() || !guestTypeId) { setAddError('Fill all fields'); return; }
    setAdding(true); setAddError('');
    try {
      await window.RNTECH_API.adminIssueTicket({ holderName:guestName.trim(), holderEmail:guestEmail.trim(), ticketTypeId:guestTypeId });
      setGuestName(''); setGuestEmail(''); setGuestTypeId(''); setShowAdd(false);
      reload();
    } catch(err) {
      setAddError(err.message || 'Failed to add guest');
    } finally { setAdding(false); }
  };

  const handleScan = async (qrValue) => {
    setShowScanner(false);
    if (!qrValue || !qrValue.trim()) {
      setScanResult({ error: 'Could not read QR code — try again' });
      return;
    }
    try {
      const result = await window.RNTECH_API.checkinByQR(qrValue.trim());
      setScanResult(result);
      reload();
    } catch(err) {
      setScanResult({ error: err.message || 'Request failed' });
    }
  };

  const scanCount = tickets.filter(t => t.status === 'used').length;
  const selectedEvent = events.find(e=>e.id===selectedId);
  const ticketTypes = selectedEvent ? (selectedEvent.ticketTypes||[]).filter(t=>t.active) : [];
  const filtered = tickets.filter(t => !search || t.holderName.toLowerCase().includes(search.toLowerCase()) || t.holderEmail.toLowerCase().includes(search.toLowerCase()));

  const btnStyle = { ...FS,background:'rgba(100,116,139,0.2)',border:'1px solid rgba(100,116,139,0.3)',color:'#94a3b8',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em' };
  const btnGreenStyle = { ...FS,background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',color:'#10b981',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em' };
  const btnRedStyle = { ...FS,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em' };

  const removeGuest = async (t) => {
    if (!window.confirm(`Remove ${t.holderName} from the guest list and delete their ticket?`)) return;
    try { await window.RNTECH_API.deleteTicket(t.id); reload(); }
    catch(err) { alert(err.message); }
  };

  return React.createElement('div', null,
    // Top bar
    React.createElement('div', { style:{display:'flex',gap:10,alignItems:'center',marginBottom:24,flexWrap:'wrap'} },
      React.createElement('select', { value:selectedId, onChange:e=>setSelectedId(e.target.value), style:{...inputSt,width:'auto',marginBottom:0,minWidth:200} },
        events.map(ev=>React.createElement('option', { key:ev.id,value:ev.id,style:{background:'#040c18'} }, ev.title))
      ),
      React.createElement('input', { placeholder:'Search name or email…',value:search,onChange:e=>setSearch(e.target.value),style:{...inputSt,width:200,marginBottom:0} }),
      React.createElement(GlowButton, { onClick:()=>{setAddError('');setShowAdd(true);},small:true }, '+ Add Guest'),
      React.createElement(GlowButton, { onClick:()=>{setScanResult(null);setShowScanner(true);},small:true,variant:'ghost' }, '⬜ Scan QR'),
      React.createElement('a', { href:window.RNTECH_API.exportTickets(selectedId)+'&token='+window.RNTECH_AUTH.getToken(), download:'guest-list.csv', style:{...FS,color:'#3272a8',fontSize:13,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',textDecoration:'none',border:'1px solid rgba(50,114,168,0.4)',padding:'8px 16px'} }, '⬇ Export CSV'),
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13} }, tickets.length+' attendees'),
      React.createElement(GenderCounter, { tickets, overrides:genderOverrides, onClickUnknown:()=>setShowGenderResolve(true) })
    ),

    // Table
    loading && React.createElement(Spinner),
    !loading && filtered.length===0 && React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)'} }, search ? 'No results for "'+search+'".' : 'No registrations yet.'),
    !loading && filtered.length>0 && React.createElement('div', { style:{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'} },
      React.createElement('table', { style:{width:'100%',borderCollapse:'collapse'} },
        React.createElement('thead', null,
          React.createElement('tr', { style:{borderBottom:'1px solid rgba(255,255,255,0.08)'} },
            ['Name','Email','Ticket Type','Ref','Status','Action'].map(h=>
              React.createElement('th', { key:h, style:{...FS,padding:'12px 14px',textAlign:'left',color:'rgba(255,255,255,0.4)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600} }, h)
            )
          )
        ),
        React.createElement('tbody', null,
          filtered.map((t,i)=>React.createElement('tr', { key:t.id, style:{borderBottom:'1px solid rgba(255,255,255,0.04)',background:i%2?'rgba(255,255,255,0.01)':'transparent'} },
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.9)'} }, t.holderName),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.5)'} }, t.holderEmail),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.5)'} }, t.ticketTypeName),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12,color:'rgba(255,255,255,0.35)',fontFamily:'monospace'} }, t.id),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:t.status==='valid'?'#10b981':'#64748b'} }, t.status),
            React.createElement('td', { style:{padding:'10px 14px',display:'flex',gap:6,flexWrap:'wrap'} },
              t.status==='valid'
                ? React.createElement('button', { onClick:()=>updateStatus(t.id,'used'), style:btnStyle }, 'Mark Used')
                : React.createElement('button', { onClick:()=>updateStatus(t.id,'valid'), style:btnGreenStyle }, 'Mark Valid'),
              React.createElement('button', { onClick:()=>removeGuest(t), style:btnRedStyle }, 'Remove')
            )
          ))
        )
      )
    ),

    // Add Guest Modal
    showAdd && React.createElement('div', { className:'modal-overlay', style:{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}, onClick:()=>setShowAdd(false) },
      React.createElement('div', { className:'modal-sheet', onClick:e=>e.stopPropagation(), style:{background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',padding:36,width:'100%',maxWidth:420} },
        React.createElement('div',{className:'modal-handle'}),
        React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:20,color:'#fff',margin:'0 0 20px',textTransform:'uppercase'} }, 'Add Guest'),
        React.createElement('input', { placeholder:'Full Name',value:guestName,onChange:e=>setGuestName(e.target.value),style:inputSt }),
        React.createElement('input', { type:'email',placeholder:'Email',value:guestEmail,onChange:e=>setGuestEmail(e.target.value),style:inputSt }),
        React.createElement('select', { value:guestTypeId,onChange:e=>setGuestTypeId(e.target.value),style:inputSt },
          React.createElement('option', { value:'' }, 'Select ticket type…'),
          ticketTypes.map(tt=>React.createElement('option', { key:tt.id,value:tt.id,style:{background:'#040c18'} }, tt.name+(tt.price?' — £'+(tt.price/100).toFixed(2):' — FREE')))
        ),
        addError && React.createElement('p', { style:{...FS,color:'#ef4444',fontSize:13,marginBottom:12} }, addError),
        React.createElement('div', { style:{display:'flex',gap:12,marginTop:8} },
          React.createElement(GlowButton, { onClick:addGuest,disabled:adding }, adding?'Adding…':'Add to Guest List'),
          React.createElement(GlowButton, { onClick:()=>setShowAdd(false),variant:'ghost' }, 'Cancel')
        )
      )
    ),

    // QR Scanner
    showScanner && React.createElement(QRScanModal, { onClose:()=>setShowScanner(false), onScan:handleScan }),
    showGenderResolve && React.createElement(GenderResolveModal, { tickets, overrides:genderOverrides, onSave:setGenderOverrides, onClose:()=>setShowGenderResolve(false) }),

    // Scan Result Card
    scanResult && React.createElement('div', { style:{position:'fixed',inset:0,zIndex:700,background:'rgba(0,0,0,0.96)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'60px 20px 20px'} },
      React.createElement('div', { style:{width:'100%',maxWidth:420,background:'#0d1829',border:'2px solid '+(scanResult.error?'rgba(239,68,68,0.5)':scanResult.alreadyUsed?'rgba(100,116,139,0.4)':'rgba(16,185,129,0.5)'),borderRadius:8,overflow:'hidden',boxShadow:'0 0 80px '+(scanResult.error?'rgba(239,68,68,0.15)':scanResult.alreadyUsed?'rgba(100,116,139,0.1)':'rgba(16,185,129,0.2)')} },
        // Colour bar at top
        React.createElement('div', { style:{height:6, background: scanResult.error?'#ef4444':scanResult.alreadyUsed?'#64748b':'#10b981'} }),
        React.createElement('div', { style:{padding:'32px 28px 28px', textAlign:'center'} },
          // Icon
          React.createElement('div', { style:{fontSize:64, lineHeight:1, marginBottom:12} }, scanResult.error ? '✗' : scanResult.alreadyUsed ? '⚠' : '✓'),
          // Status
          React.createElement('div', { style:{...FS, fontSize:24, fontWeight:800, color:'#fff', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom: scanResult.error ? 8 : 20} },
            scanResult.error ? 'Not Found' : scanResult.alreadyUsed ? 'Already Scanned' : 'Checked In!'
          ),
          // Person details
          !scanResult.error && React.createElement('div', { style:{marginBottom:20} },
            React.createElement('div', { style:{...FS, fontSize:28, fontWeight:800, color:'#fff', marginBottom:6, letterSpacing:'0.02em'} }, scanResult.holderName),
            React.createElement('div', { style:{display:'inline-block', background:'rgba(50,114,168,0.2)', border:'1px solid rgba(50,114,168,0.4)', color:'#6aa8d8', padding:'4px 14px', fontSize:13, fontWeight:600, fontFamily:'sans-serif', borderRadius:20, marginBottom:6} }, scanResult.ticketTypeName),
          ),
          // Error message
          scanResult.error && React.createElement('div', { style:{...FS, color:'#ef4444', fontSize:14, marginBottom:20} }, scanResult.error),
          // Count
          React.createElement('div', { style:{...FS, fontSize:13, color:'rgba(255,255,255,0.3)', marginBottom:28, letterSpacing:'0.04em'} },
            `${scanCount} ticket${scanCount!==1?'s':''} scanned this session`
          ),
          // Buttons
          React.createElement('button', { onClick:()=>{ setScanResult(null); setShowScanner(true); }, style:{...FS, display:'block', width:'100%', background:'#3272a8', border:'none', color:'#fff', padding:'16px', fontSize:16, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', cursor:'pointer', marginBottom:10, borderRadius:4} }, 'Next →'),
          React.createElement('button', { onClick:()=>setScanResult(null), style:{...FS, display:'block', width:'100%', background:'transparent', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.4)', padding:'14px', fontSize:13, cursor:'pointer', borderRadius:4} }, 'Done')
        )
      )
    )
  );
}

// ── Attendees ─────────────────────────────────────────────────────────────────
function TabAttendees() {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', instagram:'', role:'user' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState([]);
  const [inviteEventId, setInviteEventId] = useState('');
  const [attendeeInvite, setAttendeeInvite] = useState(false);

  const reload = () => window.RNTECH_API.getAttendees().then(a=>{ setAttendees(a); setLoading(false); }).catch(()=>setLoading(false));
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    window.RNTECH_API.getEvents().then(ev=>{ setEvents(ev); if(ev.length) setInviteEventId(nextUpcomingId(ev)); }).catch(()=>{});
  }, []);
  const inviteEvent = events.find(e=>e.id===inviteEventId);

  const openEdit = (a) => {
    setEditing(a);
    setForm({ firstName: a.firstName, lastName: a.lastName, email: a.email, instagram: a.instagram, role: a.role });
    setSaveError('');
  };

  const saveEdit = async () => {
    setSaving(true); setSaveError('');
    try {
      await window.RNTECH_API.updateUser(editing.id, form);
      setEditing(null);
      reload();
    } catch(err) {
      setSaveError(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteMember = async (a) => {
    if (!window.confirm(`Delete ${a.name}'s account? This cannot be undone.`)) return;
    try { await window.RNTECH_API.deleteUser(a.id); reload(); }
    catch(err) { alert(err.message); }
  };

  const unsubscribe = (a) => window.RNTECH_API.unsubscribeUser(a.id)
    .then(() => setAttendees(prev => prev.map(x => x.id===a.id ? {...x, subscribed:false} : x)));

  if (loading) return React.createElement(Spinner);

  const filtered = attendees.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()));

  return React.createElement('div', null,
    React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10} },
      React.createElement('div', { style:{display:'flex',gap:10,alignItems:'center'} },
        React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:14} }, attendees.length+' members'),
        React.createElement('input', { placeholder:'Search name or email…', value:search, onChange:e=>setSearch(e.target.value), style:{...inputSt,width:200,marginBottom:0} })
      ),
      React.createElement('a', { href:window.RNTECH_API.exportAttendees()+'&token='+window.RNTECH_AUTH.getToken(), download:'attendees.csv', style:{...FS,color:'#3272a8',fontSize:13,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',textDecoration:'none',border:'1px solid rgba(50,114,168,0.4)',padding:'8px 16px'} }, '⬇ Export CSV')
    ),
    events.length>0 && React.createElement('div', { style:{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',padding:'12px 16px',marginBottom:20} },
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:13} }, 'Invite all attendees to buy for:'),
      React.createElement('select', { value:inviteEventId, onChange:e=>setInviteEventId(e.target.value), style:{...inputSt,width:'auto',marginBottom:0,minWidth:200} },
        events.map(ev=>React.createElement('option', { key:ev.id,value:ev.id,style:{background:'#040c18'} }, ev.title))
      ),
      React.createElement('button', { onClick:()=>setAttendeeInvite(true), disabled:!inviteEventId, style:{...FS,background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.35)',color:'#10b981',cursor:'pointer',padding:'8px 14px',fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Invite All Attendees'),
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.35)',fontSize:12} }, '(skips anyone already on that event\'s waitlist or already ticketed)')
    ),
    attendees.length===0&&React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)'} },'No members yet.'),
    filtered.length>0&&React.createElement('div', { style:{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'} },
      React.createElement('table', { style:{width:'100%',borderCollapse:'collapse'} },
        React.createElement('thead', null,
          React.createElement('tr', { style:{borderBottom:'1px solid rgba(255,255,255,0.08)'} },
            ['Name','Email','Instagram','Tickets','Joined','Subscribed','Actions'].map(h=>
              React.createElement('th', { key:h, style:{...FS,padding:'12px 14px',textAlign:'left',color:'rgba(255,255,255,0.4)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600} }, h)
            )
          )
        ),
        React.createElement('tbody', null,
          filtered.map((a,i)=>React.createElement('tr', { key:a.id, style:{borderBottom:'1px solid rgba(255,255,255,0.04)',background:i%2?'rgba(255,255,255,0.01)':'transparent'} },
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.9)'} }, a.name),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.5)'} }, a.email),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12} },
              a.instagram
                ? React.createElement('a', { href:'https://www.instagram.com/'+a.instagram, target:'_blank', rel:'noopener noreferrer', style:{color:'#6ba3d4',textDecoration:'none'} }, a.instagram)
                : React.createElement('span', { style:{color:'rgba(255,255,255,0.2)'} }, '—')
            ),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.5)',textAlign:'center'} }, a.ticketCount),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12,color:'rgba(255,255,255,0.4)'} }, a.joinedAt.slice(0,10)),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:a.subscribed?'#10b981':'#64748b'} }, a.subscribed?'Yes':'No'),
            React.createElement('td', { style:{padding:'10px 14px',display:'flex',gap:6,flexWrap:'wrap'} },
              React.createElement('button', { onClick:()=>openEdit(a), style:{...FS,background:'rgba(50,114,168,0.15)',border:'1px solid rgba(50,114,168,0.35)',color:'#6ba3d4',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Edit'),
              a.subscribed&&React.createElement('button', { onClick:()=>unsubscribe(a), style:{...FS,background:'rgba(100,116,139,0.15)',border:'1px solid rgba(100,116,139,0.3)',color:'#94a3b8',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Unsub'),
              React.createElement('button', { onClick:()=>deleteMember(a), style:{...FS,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Delete')
            )
          ))
        )
      )
    ),

    // Edit modal
    editing&&React.createElement(Modal, { title:'Edit Member', onClose:()=>setEditing(null) },
      React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10} },
        React.createElement('div', null,
          React.createElement('label', { style:labelSt }, 'First Name'),
          React.createElement('input', { value:form.firstName, onChange:e=>setForm(f=>({...f,firstName:e.target.value})), style:inputSt })
        ),
        React.createElement('div', null,
          React.createElement('label', { style:labelSt }, 'Last Name'),
          React.createElement('input', { value:form.lastName, onChange:e=>setForm(f=>({...f,lastName:e.target.value})), style:inputSt })
        )
      ),
      React.createElement('label', { style:labelSt }, 'Email'),
      React.createElement('input', { type:'email', value:form.email, onChange:e=>setForm(f=>({...f,email:e.target.value})), style:inputSt }),
      React.createElement('label', { style:labelSt }, 'Instagram handle (no @)'),
      React.createElement('input', { value:form.instagram, onChange:e=>setForm(f=>({...f,instagram:e.target.value})), style:inputSt }),
      React.createElement('label', { style:labelSt }, 'Role'),
      React.createElement('select', { value:form.role, onChange:e=>setForm(f=>({...f,role:e.target.value})), style:{...inputSt,cursor:'pointer'} },
        React.createElement('option', { value:'user', style:{background:'#040c18'} }, 'User'),
        React.createElement('option', { value:'admin', style:{background:'#040c18'} }, 'Admin')
      ),
      saveError&&React.createElement('p', { style:{...FS,color:'#ef4444',fontSize:13,marginBottom:12} }, saveError),
      React.createElement('div', { style:{display:'flex',gap:12,marginTop:8} },
        React.createElement(GlowButton, { onClick:saveEdit, disabled:saving }, saving?'Saving…':'Save Changes'),
        React.createElement(GlowButton, { onClick:()=>setEditing(null), variant:'ghost' }, 'Cancel')
      )
    ),

    attendeeInvite && React.createElement(InviteToBuyModal, {
      allAttendeesEventId: inviteEventId,
      ticketTypes: (inviteEvent && inviteEvent.ticketTypes) || [],
      onClose: () => setAttendeeInvite(false),
      onSent: (res) => {
        setAttendeeInvite(false);
        alert(res.invited+' attendee'+(res.invited!==1?'s':'')+' invited to '+(inviteEvent?inviteEvent.title:'the event')+' (emails sending in the background). '
          + res.alreadyHandled+' skipped — already on that event\'s waitlist or already ticketed.');
      },
    })
  );
}

// ── Messages ──────────────────────────────────────────────────────────────────
function TabMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => window.RNTECH_API.getMessages().then(m=>{ setMessages(m); setLoading(false); }).catch(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

  if (loading) return React.createElement(Spinner);

  return React.createElement('div', null,
    React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:14,marginBottom:20} }, messages.filter(m=>!m.read).length+' unread'),
    messages.length===0&&React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)'} },'No messages yet.'),
    React.createElement('div', { style:{display:'flex',flexDirection:'column',gap:16} },
      messages.map(msg=>React.createElement('div', { key:msg.id, style:{background:msg.read?'rgba(5,18,44,0.5)':'rgba(5,18,44,0.92)',border:`1px solid ${msg.read?'rgba(50,114,168,0.1)':'rgba(50,114,168,0.25)'}`,backdropFilter:'blur(14px)',padding:'18px 20px'} },
        React.createElement('div', { style:{display:'flex',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:8} },
          React.createElement('div', null,
            React.createElement('span', { style:{...FS,color:'#fff',fontWeight:700,fontSize:14} }, msg.name),
            React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:12,marginLeft:10} }, msg.email)
          ),
          React.createElement('div', { style:{display:'flex',gap:8,alignItems:'center'} },
            React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.3)',fontSize:12} }, msg.sentAt.slice(0,10)),
            !msg.read&&React.createElement('button', { onClick:()=>window.RNTECH_API.markRead(msg.id).then(load), style:{...FS,background:'rgba(50,114,168,0.1)',border:'1px solid rgba(50,114,168,0.3)',color:'#3272a8',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} },'Mark Read'),
            React.createElement('button', { onClick:()=>window.RNTECH_API.deleteMessage(msg.id).then(load), style:{...FS,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} },'Delete')
          )
        ),
        React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.7)',fontSize:14,margin:0,lineHeight:1.6} }, msg.message)
      ))
    )
  );
}

// ── Email Campaigns ───────────────────────────────────────────────────────────
function TabCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:'',subject:'',bodyHtml:'',delayDays:0,active:true });
  const [saving, setSaving] = useState(false);
  const [blasting, setBlasting] = useState(null);
  const [sigHtml, setSigHtml] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [sigSaving, setSigSaving] = useState(false);
  const [sigSaved, setSigSaved] = useState(false);
  const [sigPreview, setSigPreview] = useState(false);

  const load = () => window.RNTECH_API.getCampaigns().then(c=>{ setCampaigns(c); setLoading(false); }).catch(()=>setLoading(false));
  useEffect(()=>{
    load();
    window.RNTECH_API.getSettings().then(s=>{ setSigHtml(s.email_signature||''); setNotifyEmail(s.admin_notify_email||''); }).catch(()=>{});
  },[]);

  const openNew = () => { setEditing(null); setForm({ name:'',subject:'',bodyHtml:'',delayDays:0,active:true }); setShowForm(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name:c.name,subject:c.subject,bodyHtml:c.bodyHtml,delayDays:c.delayDays,active:c.active }); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) await window.RNTECH_API.updateCampaign(editing.id, form);
      else await window.RNTECH_API.createCampaign(form);
      setShowForm(false); load();
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const blast = async (id) => {
    if (!confirm('Send this campaign to ALL active subscribers now?')) return;
    setBlasting(id);
    try {
      const res = await window.RNTECH_API.blastCampaign(id);
      alert('Sent to '+res.sent+' subscribers.');
      load();
    } catch(err) { alert(err.message); }
    finally { setBlasting(null); }
  };

  const saveSig = async () => {
    setSigSaving(true); setSigSaved(false);
    try {
      await window.RNTECH_API.saveSettings({ email_signature: sigHtml, admin_notify_email: notifyEmail });
      setSigSaved(true); setTimeout(()=>setSigSaved(false), 2500);
    } catch(err) { alert(err.message); }
    finally { setSigSaving(false); }
  };

  if (loading) return React.createElement(Spinner);

  return React.createElement('div', null,
    React.createElement('div', { style:{background:'rgba(5,18,44,0.92)',border:'1px solid rgba(50,114,168,0.25)',padding:'20px 24px',marginBottom:28} },
      React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16} },
        React.createElement('h3', { style:{...FS,fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.5)',letterSpacing:'0.12em',textTransform:'uppercase',margin:0} },'Email Settings'),
        React.createElement('div', { style:{display:'flex',gap:8,alignItems:'center'} },
          sigSaved&&React.createElement('span', { style:{...FS,color:'#10b981',fontSize:12} },'Saved ✓'),
          React.createElement(GlowButton, { small:true,onClick:saveSig,disabled:sigSaving }, sigSaving?'Saving…':'Save Settings')
        )
      ),
      React.createElement(AdminInput, { label:'Admin Notification Email (gets a copy of every contact form submission)',value:notifyEmail,onChange:e=>setNotifyEmail(e.target.value),placeholder:'your@email.com' }),
      React.createElement('div', { style:{marginBottom:8} },
        React.createElement('label', { style:labelSt },'Email Signature (HTML — appended to every outgoing email)'),
        React.createElement('textarea', { value:sigHtml,onChange:e=>setSigHtml(e.target.value),rows:5,placeholder:'<p><strong>RNTECH Team</strong><br>rntech.live · St Albans</p>',style:{...inputSt,resize:'vertical',fontFamily:'monospace',fontSize:12} })
      ),
      React.createElement('div', { style:{display:'flex',gap:8,alignItems:'center',marginBottom: sigPreview?16:0} },
        React.createElement('button', { onClick:()=>setSigPreview(v=>!v), style:{...FS,background:'transparent',border:'1px solid rgba(50,114,168,0.3)',color:'rgba(255,255,255,0.5)',cursor:'pointer',padding:'4px 12px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, sigPreview?'Hide Preview':'Preview Signature')
      ),
      sigPreview&&sigHtml&&React.createElement('div', { style:{background:'#fff',borderRadius:4,padding:'16px 20px',border:'1px solid rgba(50,114,168,0.2)'} },
        React.createElement('div', { dangerouslySetInnerHTML:{__html:sigHtml} })
      )
    ),
    React.createElement('div', { style:{background:'rgba(50,114,168,0.08)',border:'1px solid rgba(50,114,168,0.2)',padding:'16px 20px',marginBottom:24} },
      React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:13,margin:0,lineHeight:1.7} },
        React.createElement('strong', { style:{color:'#3272a8'} },'Drip Campaigns:'),' Create email sequences sent automatically to new members based on delay days after signup. "Send Now" blasts to all existing subscribers immediately.'
      )
    ),
    React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20} },
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:14} }, campaigns.length+' campaigns'),
      React.createElement(GlowButton, { small:true,onClick:openNew },'+ New Campaign')
    ),
    React.createElement('div', { style:{display:'flex',flexDirection:'column',gap:12} },
      campaigns.map(c=>React.createElement('div', { key:c.id, style:{background:'rgba(5,18,44,0.92)',border:'1px solid rgba(50,114,168,0.2)',padding:'18px 20px'} },
        React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12} },
          React.createElement('div', null,
            React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:15,color:'#fff',margin:'0 0 4px'} }, c.name),
            React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:13} }, 'Subject: '+c.subject),
            React.createElement('div', { style:{display:'flex',gap:8,marginTop:8} },
              React.createElement(Chip, { label:c.active?'Active':'Paused', color:c.active?'#10b981':'#64748b' }),
              React.createElement(Chip, { label:'Day '+c.delayDays, color:'#3272a8' }),
              React.createElement(Chip, { label:c.sentCount+' sent', color:'#9f84b2' }),
              React.createElement(Chip, { label:c.pendingCount+' pending', color:'#f59e0b' })
            )
          ),
          React.createElement('div', { style:{display:'flex',gap:8,flexWrap:'wrap'} },
            React.createElement(GlowButton, { small:true,variant:'pink',onClick:()=>blast(c.id),disabled:blasting===c.id }, blasting===c.id?'Sending…':'Send Now'),
            React.createElement(GlowButton, { small:true,variant:'ghost',onClick:()=>openEdit(c) },'Edit'),
            React.createElement(GlowButton, { small:true,variant:'danger',onClick:()=>window.RNTECH_API.deleteCampaign(c.id).then(load) },'Delete')
          )
        )
      ))
    ),
    showForm&&React.createElement(Modal, { title:editing?'Edit Campaign':'New Campaign', onClose:()=>setShowForm(false) },
      React.createElement('form', { onSubmit:save },
        React.createElement(AdminInput, { label:'Campaign Name (internal)',value:form.name,onChange:e=>setForm(f=>({...f,name:e.target.value})),required:true }),
        React.createElement(AdminInput, { label:'Email Subject',value:form.subject,onChange:e=>setForm(f=>({...f,subject:e.target.value})),required:true }),
        React.createElement(AdminInput, { label:'Send After N Days (0 = immediately on signup)',type:'number',min:0,value:form.delayDays,onChange:e=>setForm(f=>({...f,delayDays:parseInt(e.target.value)||0})) }),
        React.createElement(AdminTextarea, { label:'Email Body (HTML or plain text)',value:form.bodyHtml,onChange:e=>setForm(f=>({...f,bodyHtml:e.target.value})),rows:10,placeholder:'<h1>Welcome to RNTECH</h1>\n<p>Thanks for joining...</p>' }),
        React.createElement('div', { style:{display:'flex',gap:12,alignItems:'center',marginBottom:20} },
          React.createElement('label', { style:{...FS,color:'rgba(255,255,255,0.7)',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:8} },
            React.createElement('input', { type:'checkbox',checked:form.active,onChange:e=>setForm(f=>({...f,active:e.target.checked})),style:{accentColor:'#3272a8',width:16,height:16} }),
            'Active (send to new signups)'
          )
        ),
        React.createElement(GlowButton, { type:'submit',style:{width:'100%'},disabled:saving }, saving?'Saving…':editing?'Update Campaign':'Create Campaign')
      )
    )
  );
}

// ── Sponsors ──────────────────────────────────────────────────────────────────
function TabSponsors() {
  const [sponsors, setSponsors] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'',subtitle:'',description:'',link:'#',active:true,sortOrder:0 });
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => window.RNTECH_API.getSponsors().then(setSponsors).catch(()=>{});
  useEffect(()=>{ load(); },[]);

  const openNew = () => { setEditing(null); setForm({ name:'',subtitle:'',description:'',link:'#',active:true,sortOrder:0 }); setLogoFile(null); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name:s.name,subtitle:s.subtitle,description:s.description,link:s.link,active:s.active,sortOrder:s.sortOrder }); setLogoFile(null); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      let sp;
      if (editing) sp = await window.RNTECH_API.updateSponsor(editing.id, form);
      else sp = await window.RNTECH_API.createSponsor(form);
      if (logoFile) await window.RNTECH_API.uploadLogo(sp.id, logoFile);
      setShowForm(false); load();
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return React.createElement('div', null,
    React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20} },
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:14} }, sponsors.length+' sponsors'),
      React.createElement(GlowButton, { small:true,onClick:openNew },'+ Add Sponsor')
    ),
    React.createElement('div', { style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16} },
      sponsors.map(s=>React.createElement(FuturisticCard, { key:s.id },
        s.logo&&React.createElement('img', { src:s.logo,alt:s.name,style:{height:56,width:56,objectFit:'contain',marginBottom:10,display:'block'} }),
        React.createElement('div', { style:{...FS,fontWeight:800,fontSize:14,color:'#fff',textTransform:'uppercase',marginBottom:4} }, s.name),
        React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:12,marginBottom:12} }, s.subtitle),
        React.createElement('div', { style:{display:'flex',gap:8} },
          React.createElement(GlowButton, { small:true,variant:'ghost',onClick:()=>openEdit(s) },'Edit'),
          React.createElement(GlowButton, { small:true,variant:'danger',onClick:()=>window.RNTECH_API.deleteSponsor(s.id).then(load) },'Remove')
        )
      ))
    ),
    showForm&&React.createElement(Modal, { title:editing?'Edit Sponsor':'Add Sponsor', onClose:()=>setShowForm(false) },
      React.createElement('form', { onSubmit:save },
        React.createElement(AdminInput, { label:'Name',value:form.name,onChange:e=>setForm(f=>({...f,name:e.target.value})),required:true }),
        React.createElement(AdminInput, { label:'Subtitle',value:form.subtitle,onChange:e=>setForm(f=>({...f,subtitle:e.target.value})),placeholder:'St Albans' }),
        React.createElement(AdminTextarea, { label:'Description',value:form.description,onChange:e=>setForm(f=>({...f,description:e.target.value})),rows:2 }),
        React.createElement(AdminInput, { label:'Link URL',value:form.link,onChange:e=>setForm(f=>({...f,link:e.target.value})) }),
        React.createElement(AdminInput, { label:'Sort Order',type:'number',value:form.sortOrder,onChange:e=>setForm(f=>({...f,sortOrder:parseInt(e.target.value)||0})) }),
        React.createElement('div', { style:{marginBottom:20} },
          React.createElement('label', { style:labelSt },'Logo Image'),
          React.createElement('input', { type:'file',accept:'image/*',onChange:e=>setLogoFile(e.target.files[0]),style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:13} })
        ),
        React.createElement(GlowButton, { type:'submit',style:{width:'100%'},disabled:saving }, saving?'Saving…':editing?'Update Sponsor':'Add Sponsor')
      )
    )
  );
}

// ── Waitlist ──────────────────────────────────────────────────────────────────
// Discount applies event-wide — the recipient picks whichever active paid ticket
// type they want on the event page itself, rather than being locked to one tier
// chosen here in advance.
function InviteToBuyModal({ interest, interestIds, allAttendeesEventId, eventId, ticketTypes, onClose, onSent }) {
  const bulk = !interest && interestIds && interestIds.length > 1;
  const allAttendees = !!allAttendeesEventId;
  const paidTypes = (ticketTypes||[]).filter(t=>t.active && t.price>0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setBusy(true); setError('');
    const pct = Math.max(0, Math.min(100, Math.round(Number(discountPercent)||0)));
    try {
      const res = allAttendees
        ? await window.RNTECH_API.inviteAllAttendees(allAttendeesEventId, pct)
        : bulk
        ? await window.RNTECH_API.bulkInviteInterest(interestIds, eventId, pct)
        : await window.RNTECH_API.inviteInterest(interest.id, pct);
      onSent(res);
    } catch(err) { setError(err.message||'Failed to send invite'); }
    finally { setBusy(false); }
  };

  return React.createElement('div', { className:'modal-overlay', style:{ position:'fixed',inset:0,zIndex:700,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }, onClick:onClose },
    React.createElement('div', { onClick:e=>e.stopPropagation(), style:{ background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',padding:32,width:'100%',maxWidth:420 } },
      React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:19,color:'#fff',margin:'0 0 4px',textTransform:'uppercase'} }, allAttendees?'Invite All Attendees':bulk?'Bulk Invite to Buy':'Invite to Buy'),
      React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:18} },
        allAttendees ? 'Everyone in your Attendees list who isn\'t already on this event\'s waitlist or already ticketed.'
        : bulk ? interestIds.length+' people selected' : (interest.firstName||interest.name)+' — '+interest.email),
      paidTypes.length===0
        ? React.createElement('p', { style:{...FS,color:'#f59e0b',fontSize:13,marginBottom:16} }, 'No active paid ticket types for this event. Create one first.')
        : React.createElement(React.Fragment, null,
            React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:12,marginBottom:14,lineHeight:1.6} },
              'They\'ll land on the event page and can buy any ticket type below — the discount applies to whichever one they pick:'),
            React.createElement('ul', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:12,margin:'0 0 16px',paddingLeft:18,lineHeight:1.8} },
              paidTypes.map(t=>React.createElement('li', { key:t.id }, t.name+' — £'+(t.price/100).toFixed(2)))
            ),
            React.createElement('label', { style:{...FS,display:'block',fontSize:11,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,0.4)',marginBottom:6} }, 'Discount % (local customer)'),
            React.createElement('input', { type:'number', min:0, max:100, step:1, value:discountPercent, onChange:e=>setDiscountPercent(e.target.value), style:inputSt }),
            React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:13,marginBottom:16} },
              discountPercent>0 ? `${discountPercent}% off any ticket type they choose` : 'Full price — no discount')
          ),
      error && React.createElement('div', { style:{ color:'#ef4444',fontSize:13,marginBottom:12,...FS } }, error),
      React.createElement('div', { style:{display:'flex',gap:10,justifyContent:'flex-end'} },
        React.createElement('button', { onClick:onClose, style:{...FS,background:'none',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.6)',cursor:'pointer',padding:'8px 16px'} }, 'Cancel'),
        paidTypes.length>0 && React.createElement('button', { onClick:send, disabled:busy, style:{...FS,background:'rgba(50,114,168,0.25)',border:'1px solid rgba(50,114,168,0.5)',color:'#fff',cursor:'pointer',padding:'8px 16px',fontWeight:700} },
          busy ? 'Sending…' : allAttendees ? 'Invite All Attendees' : bulk ? `Send ${interestIds.length} Invite Emails` : 'Send Invite Email')
      )
    )
  );
}

function TabWaitlist() {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [inviteTarget, setInviteTarget] = useState(null);
  const [bulkInvite, setBulkInvite] = useState(false);
  const [attendeeInvite, setAttendeeInvite] = useState(false);
  const [checked, setChecked] = useState(() => new Set());

  useEffect(() => {
    window.RNTECH_API.getEvents().then(ev=>{ setEvents(ev); if(ev.length) setSelectedId(nextUpcomingId(ev)); }).catch(()=>{});
  },[]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setChecked(new Set());
    window.RNTECH_API.adminGetInterest(selectedId).then(d=>{ setInterests(d); setLoading(false); }).catch(()=>setLoading(false));
  },[selectedId]);

  const reload = () => window.RNTECH_API.adminGetInterest(selectedId).then(setInterests).catch(()=>{});

  const toggleChecked = (id) => setChecked(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectableIds = (list) => list.filter(i=>i.status==='pending'||i.status==='invited').map(i=>i.id);
  const toggleSelectAll = (list) => setChecked(prev => {
    const ids = selectableIds(list);
    return prev.size === ids.length ? new Set() : new Set(ids);
  });

  const approve = async (id) => {
    if (!window.confirm('Issue a free ticket to this person? Use "Invite to Buy" instead if they should pay.')) return;
    try { await window.RNTECH_API.approveInterest(id); reload(); }
    catch(err) { alert(err.message); }
  };
  const reject = async (id) => {
    try { await window.RNTECH_API.rejectInterest(id); reload(); }
    catch(err) { alert(err.message); }
  };
  const removeInterest = async (item) => {
    if (!window.confirm(`Remove ${item.firstName || item.name} from the waitlist entirely?`)) return;
    try { await window.RNTECH_API.deleteInterest(item.id); reload(); }
    catch(err) { alert(err.message); }
  };

  const selectedEvent = events.find(e=>e.id===selectedId);
  const pending = interests.filter(i=>i.status==='pending').length;
  const invited = interests.filter(i=>i.status==='invited').length;
  const approved = interests.filter(i=>i.status==='approved').length;
  const rejected = interests.filter(i=>i.status==='rejected').length;
  const statusColor = { pending:'#f59e0b', invited:'#6ba3d4', approved:'#10b981', rejected:'#ef4444' };

  const q = search.toLowerCase();
  const filtered = search
    ? interests.filter(i =>
        (i.firstName||i.name||'').toLowerCase().includes(q) ||
        (i.lastName||'').toLowerCase().includes(q) ||
        (i.email||'').toLowerCase().includes(q) ||
        (i.instagram||'').toLowerCase().includes(q)
      )
    : interests;

  return React.createElement('div', null,
    React.createElement('div', { style:{display:'flex',gap:10,alignItems:'center',marginBottom:24,flexWrap:'wrap'} },
      React.createElement('select', { value:selectedId,onChange:e=>setSelectedId(e.target.value),style:{...inputSt,width:'auto',marginBottom:0,minWidth:200} },
        events.map(ev=>React.createElement('option', { key:ev.id,value:ev.id,style:{background:'#040c18'} }, ev.title))
      ),
      React.createElement('input', { placeholder:'Search name, email or instagram…',value:search,onChange:e=>setSearch(e.target.value),style:{...inputSt,width:240,marginBottom:0} }),
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13} }, pending+' pending · '+invited+' invited · '+approved+' has ticket · '+rejected+' rejected'),
      selectedId && React.createElement('button', { onClick:()=>setAttendeeInvite(true), style:{...FS,background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.35)',color:'#10b981',cursor:'pointer',padding:'8px 14px',fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Invite All Attendees')
    ),
    React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.35)',fontSize:13,marginBottom:20,lineHeight:1.6} },
      'People register interest here before you open the guest list. "Invite to Buy" emails them a personal checkout link (with an optional local-customer discount) — their ticket is issued automatically once they pay. "Comp Ticket" issues a free ticket instantly instead. Tick multiple people and use "Bulk Invite to Buy" to send them all the same offer at once, or use "Invite All Attendees" to offer it to your whole attendee list (skipping anyone already on this waitlist or already ticketed). Set an event\'s Registration Mode to "Interest Only" to enable this flow.'
    ),
    checked.size>0 && React.createElement('div', { style:{display:'flex',gap:12,alignItems:'center',background:'rgba(50,114,168,0.1)',border:'1px solid rgba(50,114,168,0.3)',padding:'10px 16px',marginBottom:16} },
      React.createElement('span', { style:{...FS,color:'#fff',fontSize:13,fontWeight:700} }, checked.size+' selected'),
      React.createElement('button', { onClick:()=>setBulkInvite(true), style:{...FS,background:'rgba(50,114,168,0.25)',border:'1px solid rgba(50,114,168,0.5)',color:'#fff',cursor:'pointer',padding:'6px 14px',fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Bulk Invite to Buy'),
      React.createElement('button', { onClick:()=>setChecked(new Set()), style:{...FS,background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'6px 8px',fontSize:12} }, 'Clear selection')
    ),
    loading && React.createElement(Spinner),
    !loading && filtered.length===0 && React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)'} }, search ? 'No results for "'+search+'".' : 'No interest registrations yet for this event.'),
    !loading && filtered.length>0 && React.createElement('div', { style:{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'} },
      React.createElement('table', { style:{width:'100%',borderCollapse:'collapse'} },
        React.createElement('thead', null,
          React.createElement('tr', { style:{borderBottom:'1px solid rgba(255,255,255,0.08)'} },
            React.createElement('th', { style:{padding:'12px 14px',width:20} },
              React.createElement('input', { type:'checkbox', checked:selectableIds(filtered).length>0 && checked.size===selectableIds(filtered).length, onChange:()=>toggleSelectAll(filtered), title:'Select all (pending/invited)' })
            ),
            ['First Name','Last Name','Instagram','Submitted','Status','Action'].map(h=>
              React.createElement('th', { key:h, style:{...FS,padding:'12px 14px',textAlign:'left',color:'rgba(255,255,255,0.4)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600} }, h)
            )
          )
        ),
        React.createElement('tbody', null,
          filtered.map((item,i)=>React.createElement('tr', { key:item.id, style:{borderBottom:'1px solid rgba(255,255,255,0.04)',background:i%2?'rgba(255,255,255,0.01)':'transparent'} },
            React.createElement('td', { style:{padding:'10px 14px'} },
              (item.status==='pending'||item.status==='invited') && React.createElement('input', { type:'checkbox', checked:checked.has(item.id), onChange:()=>toggleChecked(item.id) })
            ),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.9)'} }, item.firstName||item.name),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.9)'} }, item.lastName||''),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12} }, item.instagram
              ? React.createElement('a', { href:'https://www.instagram.com/'+item.instagram, target:'_blank', rel:'noopener noreferrer', style:{color:'#6ba3d4',textDecoration:'none'} }, item.instagram)
              : React.createElement('span', { style:{color:'rgba(255,255,255,0.3)'} }, '—')
            ),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12,color:'rgba(255,255,255,0.3)'} }, item.createdAt.slice(0,10)),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12,color:statusColor[item.status]||'#fff',fontWeight:700,textTransform:'uppercase'} }, item.status),
            React.createElement('td', { style:{padding:'10px 14px',display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'} },
              (item.status==='pending'||item.status==='invited') && React.createElement('button', { onClick:()=>setInviteTarget(item), style:{...FS,background:'rgba(50,114,168,0.18)',border:'1px solid rgba(50,114,168,0.4)',color:'#6ba3d4',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, item.status==='invited'?'Re-invite':'Invite to Buy'),
              item.status==='pending' && React.createElement('button', { onClick:()=>approve(item.id), style:{...FS,background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',color:'#10b981',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Comp Ticket'),
              item.status==='pending' && React.createElement('button', { onClick:()=>reject(item.id), style:{...FS,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Reject'),
              item.status==='invited' && React.createElement('span', { style:{...FS,color:'#6ba3d4',fontSize:12} }, '✉ Invited'+(item.inviteDiscountPercent>0?' ('+item.inviteDiscountPercent+'% off)':'')),
              item.status==='approved' && React.createElement('span', { style:{...FS,color:'#10b981',fontSize:12} }, '✓ Has ticket'),
              item.status==='rejected' && React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.3)',fontSize:12} }, 'Rejected'),
              React.createElement('button', { onClick:()=>removeInterest(item), style:{...FS,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',color:'#ef4444',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Remove')
            )
          ))
        )
      )
    ),
    inviteTarget && React.createElement(InviteToBuyModal, {
      interest: inviteTarget,
      ticketTypes: (selectedEvent && selectedEvent.ticketTypes) || [],
      onClose: () => setInviteTarget(null),
      onSent: (res) => { setInviteTarget(null); reload(); alert('Invite sent to '+inviteTarget.email+(res.inviteLink?('\n\nLink: '+res.inviteLink):'')); },
    }),
    bulkInvite && React.createElement(InviteToBuyModal, {
      interestIds: Array.from(checked),
      eventId: selectedId,
      ticketTypes: (selectedEvent && selectedEvent.ticketTypes) || [],
      onClose: () => setBulkInvite(false),
      onSent: (res) => {
        setBulkInvite(false); setChecked(new Set()); reload();
        const msg = res.invited.length+' invite'+(res.invited.length!==1?'s':'')+' sent'
          + (res.skipped.length ? ('. Skipped '+res.skipped.length+': '+res.skipped.map(s=>s.reason).join(', ')) : '.');
        alert(msg);
      },
    }),
    attendeeInvite && React.createElement(InviteToBuyModal, {
      allAttendeesEventId: selectedId,
      ticketTypes: (selectedEvent && selectedEvent.ticketTypes) || [],
      onClose: () => setAttendeeInvite(false),
      onSent: (res) => {
        setAttendeeInvite(false); reload();
        alert(res.invited+' attendee'+(res.invited!==1?'s':'')+' invited (emails sending in the background). '
          + res.alreadyHandled+' skipped — already on this waitlist or already ticketed.');
      },
    })
  );
}

// ── Inbox ─────────────────────────────────────────────────────────────────────
function TabInbox() {
  const [view, setView] = useState('inbox');
  const [emails, setEmails] = useState(null);
  const [sentEmails, setSentEmails] = useState(null);
  const [junkEmails, setJunkEmails] = useState(null);
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState({ to:'', subject:'', body:'' });
  const [signature, setSignature] = useState('');

  useEffect(() => {
    window.RNTECH_API.getSettings().then(s => setSignature(s.email_signature || '')).catch(() => {});
  }, []);

  const loadInbox = () => {
    setLoading(true);
    window.RNTECH_API.getInbox()
      .then(data => { setEmails(data); setLoading(false); })
      .catch(() => { setEmails([]); setLoading(false); });
  };

  const loadSent = () => {
    setLoading(true);
    window.RNTECH_API.getSent()
      .then(data => { setSentEmails(data); setLoading(false); })
      .catch(() => { setSentEmails([]); setLoading(false); });
  };

  const loadJunk = () => {
    setLoading(true);
    window.RNTECH_API.getJunk()
      .then(data => { setJunkEmails(data); setLoading(false); })
      .catch(() => { setJunkEmails([]); setLoading(false); });
  };

  useEffect(() => { loadInbox(); }, []);

  const switchView = (v) => {
    setView(v); setSelected(null); setMsg(null); setReplyOpen(false); setComposing(false);
    if (v === 'sent' && !sentEmails) loadSent();
    if (v === 'inbox' && !emails) loadInbox();
    if (v === 'junk' && !junkEmails) loadJunk();
  };

  const openMsg = (uid, forView) => {
    setSelected(uid); setMsg(null); setReplyOpen(false); setReply(''); setComposing(false);
    const fetcher = forView === 'sent' ? window.RNTECH_API.getSentMessage
      : forView === 'junk' ? window.RNTECH_API.getJunkMessage
      : window.RNTECH_API.getMessage;
    fetcher(uid).then(setMsg).catch(() => {});
    if (forView === 'inbox') setEmails(prev => prev.map(e => e.uid === uid ? { ...e, unread: false } : e));
    if (forView === 'junk') setJunkEmails(prev => prev.map(e => e.uid === uid ? { ...e, unread: false } : e));
  };

  const sendReply = async () => {
    if (!reply.trim() || !msg) return;
    setSending(true);
    try {
      await window.RNTECH_API.replyMessage({ to: msg.from, subject: msg.subject, body: reply, message_id: msg.message_id });
      setReply(''); setReplyOpen(false);
    } catch(e) { alert(e.message || 'Failed to send'); }
    setSending(false);
  };

  const sendCompose = async () => {
    if (!compose.to.trim() || !compose.body.trim()) return;
    setSending(true);
    try {
      await window.RNTECH_API.replyMessage({ to: compose.to, subject: compose.subject, body: compose.body, message_id: '' });
      setCompose({ to:'', subject:'', body:'' }); setComposing(false);
    } catch(e) { alert(e.message || 'Failed to send'); }
    setSending(false);
  };

  const inpSt = { width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(50,114,168,0.3)', color:'#fff', padding:'8px 12px', fontFamily:'sans-serif', fontSize:13, marginBottom:8 };
  const panelSt = { display:'flex', gap:0, border:'1px solid rgba(50,114,168,0.2)', minHeight:500 };
  const listSt = { width:300, flexShrink:0, borderRight:'1px solid rgba(50,114,168,0.2)', overflowY:'auto', maxHeight:600 };
  const rowSt = (uid) => ({
    padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)',
    background: selected === uid ? 'rgba(50,114,168,0.15)' : 'transparent',
    fontFamily:'sans-serif',
  });
  const viewSt = { flex:1, padding:24, overflowY:'auto', maxHeight:600 };
  const btnSt = (primary) => ({ ...FS, background: primary ? '#3272a8' : 'rgba(50,114,168,0.1)', border: primary ? 'none' : '1px solid rgba(50,114,168,0.4)', color: primary ? '#fff' : '#3272a8', padding:'8px 20px', cursor:'pointer', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' });
  const tabBtnSt = (active) => ({ ...FS, background: active ? 'rgba(50,114,168,0.25)' : 'transparent', border:'1px solid '+(active?'rgba(50,114,168,0.6)':'rgba(50,114,168,0.2)'), color: active ? '#fff' : 'rgba(255,255,255,0.5)', padding:'6px 18px', cursor:'pointer', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' });

  const activeList = view === 'inbox' ? emails : view === 'junk' ? junkEmails : sentEmails;
  const isSentView = view === 'sent';

  return React.createElement('div', { style:{marginTop:24} },
    React.createElement('div', { style:{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16} },
      React.createElement('div', { style:{display:'flex', gap:4} },
        React.createElement('button', { onClick:()=>switchView('inbox'), style:tabBtnSt(view==='inbox') }, 'Inbox'+(emails ? ` (${emails.filter(e=>e.unread).length})` : '')),
        React.createElement('button', { onClick:()=>switchView('junk'), style:tabBtnSt(view==='junk') }, 'Junk'+(junkEmails ? ` (${junkEmails.filter(e=>e.unread).length})` : '')),
        React.createElement('button', { onClick:()=>switchView('sent'), style:tabBtnSt(view==='sent') }, 'Sent')
      ),
      React.createElement('div', { style:{display:'flex', gap:8} },
        React.createElement('button', { onClick:()=>{ view==='inbox'?loadInbox():view==='junk'?loadJunk():loadSent(); }, style:{...btnSt(false), fontSize:11} }, 'Refresh'),
        React.createElement('button', { onClick:()=>{ setComposing(true); setSelected(null); }, style:btnSt(true) }, '+ Compose')
      )
    ),
    composing
      ? React.createElement('div', { style:{border:'1px solid rgba(50,114,168,0.3)', padding:24, background:'rgba(50,114,168,0.05)'} },
          React.createElement('div', { style:{...FS, fontSize:13, fontWeight:700, color:'#fff', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.06em'} }, 'New Email'),
          React.createElement('input', { placeholder:'To', value:compose.to, onChange:e=>setCompose(p=>({...p,to:e.target.value})), style:inpSt }),
          React.createElement('input', { placeholder:'Subject', value:compose.subject, onChange:e=>setCompose(p=>({...p,subject:e.target.value})), style:inpSt }),
          React.createElement('textarea', { placeholder:'Message...', value:compose.body, onChange:e=>setCompose(p=>({...p,body:e.target.value})), rows:8, style:{...inpSt, resize:'vertical'} }),
          signature && React.createElement('div', { style:{background:'#fff', border:'1px solid rgba(50,114,168,0.2)', borderRadius:4, padding:'12px 16px', marginBottom:8} },
            React.createElement('div', { style:{fontFamily:'sans-serif', fontSize:11, color:'#999', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em'} }, '— Signature'),
            React.createElement('div', { dangerouslySetInnerHTML:{__html:signature} })
          ),
          React.createElement('div', { style:{display:'flex', gap:8} },
            React.createElement('button', { onClick:sendCompose, disabled:sending, style:{...btnSt(true), opacity:sending?0.5:1} }, sending ? 'Sending...' : 'Send'),
            React.createElement('button', { onClick:()=>setComposing(false), style:{...btnSt(false)} }, 'Cancel')
          )
        )
      : React.createElement('div', { style:panelSt },
          React.createElement('div', { style:listSt },
            !activeList || activeList.length === 0
              ? React.createElement('div', { style:{padding:24, color:'rgba(255,255,255,0.3)', fontFamily:'sans-serif', fontSize:13} }, loading ? 'Loading...' : (isSentView ? 'No sent emails' : view === 'junk' ? 'No junk emails' : 'No emails'))
              : activeList.map(e =>
                  React.createElement('div', { key:e.uid, style:rowSt(e.uid), onClick:()=>openMsg(e.uid, view) },
                    React.createElement('div', { style:{fontSize:11, fontWeight:600, color:'rgba(50,114,168,0.8)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2} }, isSentView ? 'To' : 'From'),
                    React.createElement('div', { style:{fontSize:12, fontWeight: (!isSentView && e.unread) ? 700 : 400, color: (!isSentView && e.unread) ? '#fff' : 'rgba(255,255,255,0.7)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'} },
                      isSentView
                        ? (e.to || '').replace(/<.*>/, '').trim() || e.to
                        : (e.from || '').replace(/<.*>/, '').trim() || e.from
                    ),
                    React.createElement('div', { style:{fontSize:12, fontWeight: (!isSentView && e.unread) ? 600 : 400, color: (!isSentView && e.unread) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:2} }, e.subject),
                    React.createElement('div', { style:{fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:4} }, e.date ? new Date(e.date).toLocaleString('en-GB', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '')
                  )
                )
          ),
          React.createElement('div', { style:viewSt },
            !selected
              ? React.createElement('div', { style:{color:'rgba(255,255,255,0.2)', fontFamily:'sans-serif', fontSize:13, paddingTop:40, textAlign:'center'} }, 'Select an email to read')
              : !msg
              ? React.createElement('div', { style:{color:'rgba(255,255,255,0.3)', fontFamily:'sans-serif', fontSize:13} }, 'Loading...')
              : React.createElement('div', null,
                  React.createElement('div', { style:{marginBottom:16} },
                    React.createElement('div', { style:{...FS, fontSize:15, fontWeight:700, color:'#fff', marginBottom:8} }, msg.subject),
                    React.createElement('div', { style:{fontFamily:'sans-serif', fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:2} }, isSentView ? `To: ${msg.to}` : `From: ${msg.from}`),
                    React.createElement('div', { style:{fontFamily:'sans-serif', fontSize:12, color:'rgba(255,255,255,0.3)'} }, `Date: ${msg.date}`)
                  ),
                  React.createElement('div', { style:{borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:16, marginBottom:16} },
                    msg.body_html
                      ? React.createElement('iframe', { srcDoc: msg.body_html, style:{width:'100%', minHeight:300, border:'none', background:'#fff', borderRadius:4}, title:'email' })
                      : React.createElement('pre', { style:{fontFamily:'sans-serif', fontSize:13, color:'rgba(255,255,255,0.7)', whiteSpace:'pre-wrap', margin:0} }, msg.body_text || '(empty)')
                  ),
                  !isSentView && (
                    !replyOpen
                      ? React.createElement('button', { onClick:()=>setReplyOpen(true), style:btnSt(false) }, 'Reply')
                      : React.createElement('div', null,
                          React.createElement('textarea', { value:reply, onChange:e=>setReply(e.target.value), placeholder:'Write your reply...', rows:5, style:{...inpSt, resize:'vertical'} }),
                          signature && React.createElement('div', { style:{background:'#fff', border:'1px solid rgba(50,114,168,0.2)', borderRadius:4, padding:'12px 16px', marginBottom:8} },
                            React.createElement('div', { style:{fontFamily:'sans-serif', fontSize:11, color:'#999', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em'} }, '— Signature (auto-appended)'),
                            React.createElement('div', { dangerouslySetInnerHTML:{__html:signature} })
                          ),
                          React.createElement('div', { style:{display:'flex', gap:8} },
                            React.createElement('button', { onClick:sendReply, disabled:sending, style:{...btnSt(true), opacity:sending?0.5:1} }, sending ? 'Sending...' : 'Send'),
                            React.createElement('button', { onClick:()=>setReplyOpen(false), style:btnSt(false) }, 'Cancel')
                          )
                        )
                  )
                )
          )
        )
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
function PageAdmin({ user }) {
  const [tab, setTab] = useState('overview');

  if (!user || user.role !== 'admin') return React.createElement('div', { style:{padding:'100px 24px',textAlign:'center',...FS,color:'rgba(255,255,255,0.5)'} }, 'Admin access required.');

  const renderTab = () => {
    switch(tab) {
      case 'overview':  return React.createElement(TabOverview);
      case 'events':    return React.createElement(TabEvents);
      case 'mixes':     return React.createElement(TabMixes);
      case 'guestlist': return React.createElement(TabGuestList);
      case 'waitlist':  return React.createElement(TabWaitlist);
      case 'attendees': return React.createElement(TabAttendees);
      case 'messages':  return React.createElement(TabMessages);
      case 'campaigns': return React.createElement(TabCampaigns);
      case 'inbox':     return React.createElement(TabInbox);
      case 'sponsors':  return React.createElement(TabSponsors);
      default:          return null;
    }
  };

  return React.createElement('div', { style:{padding:'100px 24px 100px',maxWidth:1100,margin:'0 auto'} },
    React.createElement(SectionHeader, { title:'Admin', subtitle:'RNTECH Management Panel' }),
    React.createElement(TabBar, { tabs:ADMIN_TABS, active:tab, onChange:setTab }),
    renderTab()
  );
}

window.PageAdmin = PageAdmin;
