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
  { id: 'sponsors',   label: 'Sponsors' },
];

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
  return React.createElement('div', { style:{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}, onClick:onClose },
    React.createElement('div', { onClick:e=>e.stopPropagation(), style:{background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',borderRadius:0,padding:32,width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 0 60px rgba(50,114,168,0.2)'} },
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
  const [ttForm, setTtForm] = useState({ name:'',price:0,capacity:100,description:'',active:true });

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

  const openTicketTypes = async (ev) => {
    setSelectedEvent(ev);
    const data = await window.RNTECH_API.getEvent(ev.id).catch(()=>({ ticketTypes:[] }));
    setTicketTypes(data.ticketTypes||[]);
    setTtForm({ name:'',price:0,capacity:100,description:'',active:true });
  };

  const saveTicketType = async (e) => {
    e.preventDefault();
    await window.RNTECH_API.createTicketType({ ...ttForm, eventId:selectedEvent.id }).catch(err=>alert(err.message));
    const data = await window.RNTECH_API.getEvent(selectedEvent.id).catch(()=>({ ticketTypes:[] }));
    setTicketTypes(data.ticketTypes||[]);
    setTtForm({ name:'',price:0,capacity:100,description:'',active:true });
  };

  const delTicketType = async (id) => {
    if (!confirm('Delete this ticket type?')) return;
    await window.RNTECH_API.deleteTicketType(id).catch(err=>alert(err.message));
    const data = await window.RNTECH_API.getEvent(selectedEvent.id).catch(()=>({ ticketTypes:[] }));
    setTicketTypes(data.ticketTypes||[]);
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
          React.createElement(AdminInput, { label:'Date (YYYY-MM-DD)',value:form.date,onChange:e=>setForm(f=>({...f,date:e.target.value})),placeholder:'2025-05-25',required:true }),
          React.createElement(AdminInput, { label:'Display Date',value:form.displayDate,onChange:e=>setForm(f=>({...f,displayDate:e.target.value})),placeholder:'Sun 25th May 2025',required:true })
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
          React.createElement('input', { type:'file',accept:'image/*',onChange:e=>setPosterFile(e.target.files[0]),style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:13} })
        ),
        React.createElement(GlowButton, { type:'submit',style:{width:'100%'},disabled:saving }, saving?'Saving…':editing?'Update Event':'Create Event')
      )
    ),
    // Ticket Types modal
    selectedEvent&&React.createElement(Modal, { title:'Ticket Types — '+selectedEvent.title, onClose:()=>setSelectedEvent(null) },
      ticketTypes.length>0&&React.createElement('div', { style:{marginBottom:20} },
        ticketTypes.map(tt=>React.createElement('div', { key:tt.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'} },
          React.createElement('div', null,
            React.createElement('div', { style:{...FS,color:'#fff',fontWeight:700,fontSize:14} }, tt.name),
            React.createElement('div', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:12} }, (tt.price===0?'FREE':'£'+(tt.price/100).toFixed(2))+' · '+tt.soldCount+'/'+tt.capacity+' sold')
          ),
          React.createElement(GlowButton, { small:true,variant:'danger',onClick:()=>delTicketType(tt.id) },'Remove')
        ))
      ),
      React.createElement('form', { onSubmit:saveTicketType },
        React.createElement('h4', { style:{...FS,color:'rgba(255,255,255,0.6)',fontSize:12,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:16,marginTop:ticketTypes.length>0?24:0} },'Add Ticket Type'),
        React.createElement(AdminInput, { label:'Name',value:ttForm.name,onChange:e=>setTtForm(f=>({...f,name:e.target.value})),placeholder:'General Entry',required:true }),
        React.createElement('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12} },
          React.createElement(AdminInput, { label:'Price (pence, 0=free)',type:'number',value:ttForm.price,onChange:e=>setTtForm(f=>({...f,price:parseInt(e.target.value)||0})),min:0 }),
          React.createElement(AdminInput, { label:'Capacity',type:'number',value:ttForm.capacity,onChange:e=>setTtForm(f=>({...f,capacity:parseInt(e.target.value)||100})),min:1 })
        ),
        React.createElement(AdminInput, { label:'Description',value:ttForm.description,onChange:e=>setTtForm(f=>({...f,description:e.target.value})) }),
        React.createElement(GlowButton, { type:'submit',style:{width:'100%'} },'Add Ticket Type')
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
  const html5QrRef = React.useRef(null);
  const [error, setError] = React.useState('');
  const [scanning, setScanning] = React.useState(false);

  React.useEffect(() => {
    if (typeof Html5Qrcode === 'undefined') { setError('QR scanner library not loaded.'); return; }
    const scanner = new Html5Qrcode('qr-scanner-region');
    html5QrRef.current = scanner;
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decoded) => { scanner.stop().catch(()=>{}); onScan(decoded); },
      () => {}
    ).then(() => setScanning(true)).catch(err => setError('Camera denied or unavailable: ' + (err || '')));
    return () => { scanner.stop().catch(()=>{}); };
  }, []);

  const overlayStyle = { position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.95)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24 };
  return React.createElement('div', { style:overlayStyle },
    React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:20,color:'#fff',margin:'0 0 20px',textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Scan Ticket QR'),
    React.createElement('div', { id:'qr-scanner-region', style:{width:280,height:280,background:'#000',border:'2px solid rgba(50,114,168,0.6)',borderRadius:4} }),
    error && React.createElement('p', { style:{...FS,color:'#ef4444',fontSize:13,marginTop:16,textAlign:'center',maxWidth:300} }, error),
    !scanning && !error && React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13,marginTop:16} }, 'Starting camera…'),
    scanning && !error && React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13,marginTop:16} }, 'Point at QR code on ticket'),
    React.createElement('div', { style:{marginTop:20} },
      React.createElement(GlowButton, { onClick:()=>{ if(html5QrRef.current) html5QrRef.current.stop().catch(()=>{}); onClose(); }, variant:'ghost' }, 'Cancel')
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

  useEffect(() => {
    window.RNTECH_API.getEvents().then(ev=>{ setEvents(ev); if(ev.length) setSelectedId(ev[0].id); }).catch(()=>{});
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
    try {
      const result = await window.RNTECH_API.checkinByQR(qrValue);
      setScanResult(result);
      reload();
    } catch(err) {
      setScanResult({ error: err.message || 'Ticket not found' });
    }
  };

  const selectedEvent = events.find(e=>e.id===selectedId);
  const ticketTypes = selectedEvent ? (selectedEvent.ticketTypes||[]).filter(t=>t.active) : [];
  const filtered = tickets.filter(t => !search || t.holderName.toLowerCase().includes(search.toLowerCase()) || t.holderEmail.toLowerCase().includes(search.toLowerCase()));

  const btnStyle = { ...FS,background:'rgba(100,116,139,0.2)',border:'1px solid rgba(100,116,139,0.3)',color:'#94a3b8',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em' };
  const btnGreenStyle = { ...FS,background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',color:'#10b981',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em' };

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
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13} }, tickets.length+' attendees')
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
            React.createElement('td', { style:{padding:'10px 14px'} },
              t.status==='valid'
                ? React.createElement('button', { onClick:()=>updateStatus(t.id,'used'), style:btnStyle }, 'Mark Used')
                : React.createElement('button', { onClick:()=>updateStatus(t.id,'valid'), style:btnGreenStyle }, 'Mark Valid')
            )
          ))
        )
      )
    ),

    // Add Guest Modal
    showAdd && React.createElement('div', { style:{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}, onClick:()=>setShowAdd(false) },
      React.createElement('div', { onClick:e=>e.stopPropagation(), style:{background:'#040c18',border:'1px solid rgba(50,114,168,0.3)',padding:36,width:'100%',maxWidth:420} },
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

    // Scan Result Modal
    scanResult && React.createElement('div', { style:{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}, onClick:()=>setScanResult(null) },
      React.createElement('div', { onClick:e=>e.stopPropagation(), style:{background:'#040c18',border:'1px solid '+(scanResult.error?'rgba(239,68,68,0.4)':scanResult.alreadyUsed?'rgba(100,116,139,0.4)':'rgba(16,185,129,0.4)'),padding:36,width:'100%',maxWidth:380,textAlign:'center'} },
        React.createElement('div', { style:{fontSize:52,marginBottom:16} }, scanResult.error?'✗':scanResult.alreadyUsed?'⚠':'✓'),
        React.createElement('h3', { style:{...FS,fontWeight:800,fontSize:22,color:'#fff',margin:'0 0 12px',textTransform:'uppercase'} },
          scanResult.error ? 'Not Found' : scanResult.alreadyUsed ? 'Already Used' : 'Checked In!'
        ),
        !scanResult.error && React.createElement('div', null,
          React.createElement('p', { style:{...FS,fontSize:18,color:'#fff',margin:'0 0 4px',fontWeight:600} }, scanResult.holderName),
          React.createElement('p', { style:{...FS,fontSize:13,color:'rgba(255,255,255,0.5)',margin:'0 0 4px'} }, scanResult.ticketTypeName),
          React.createElement('p', { style:{...FS,fontSize:12,color:'rgba(255,255,255,0.3)',fontFamily:'monospace'} }, scanResult.id)
        ),
        scanResult.error && React.createElement('p', { style:{...FS,color:'#ef4444',fontSize:14,marginBottom:16} }, scanResult.error),
        React.createElement('div', { style:{marginTop:24} },
          React.createElement(GlowButton, { onClick:()=>setScanResult(null) }, 'Close')
        )
      )
    )
  );
}

// ── Attendees ─────────────────────────────────────────────────────────────────
function TabAttendees() {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { window.RNTECH_API.getAttendees().then(a=>{ setAttendees(a); setLoading(false); }).catch(()=>setLoading(false)); },[]);

  if (loading) return React.createElement(Spinner);

  return React.createElement('div', null,
    React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20} },
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.5)',fontSize:14} }, attendees.length+' members'),
      React.createElement('a', { href:window.RNTECH_API.exportAttendees()+'&token='+window.RNTECH_AUTH.getToken(), download:'attendees.csv', style:{...FS,color:'#3272a8',fontSize:13,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',textDecoration:'none',border:'1px solid rgba(50,114,168,0.4)',padding:'8px 16px'} }, '⬇ Export CSV')
    ),
    attendees.length===0&&React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)'} },'No members yet.'),
    attendees.length>0&&React.createElement('div', { style:{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'} },
      React.createElement('table', { style:{width:'100%',borderCollapse:'collapse'} },
        React.createElement('thead', null,
          React.createElement('tr', { style:{borderBottom:'1px solid rgba(255,255,255,0.08)'} },
            ['Name','Email','Tickets','Joined','Subscribed','Action'].map(h=>
              React.createElement('th', { key:h, style:{...FS,padding:'12px 14px',textAlign:'left',color:'rgba(255,255,255,0.4)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600} }, h)
            )
          )
        ),
        React.createElement('tbody', null,
          attendees.map((a,i)=>React.createElement('tr', { key:a.id, style:{borderBottom:'1px solid rgba(255,255,255,0.04)',background:i%2?'rgba(255,255,255,0.01)':'transparent'} },
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.9)'} }, a.name),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.5)'} }, a.email),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.5)',textAlign:'center'} }, a.ticketCount),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12,color:'rgba(255,255,255,0.4)'} }, a.joinedAt.slice(0,10)),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:a.subscribed?'#10b981':'#64748b'} }, a.subscribed?'Yes':'No'),
            React.createElement('td', { style:{padding:'10px 14px'} },
              a.subscribed&&React.createElement('button', { onClick:()=>window.RNTECH_API.unsubscribeUser(a.id).then(()=>setAttendees(prev=>prev.map(x=>x.id===a.id?{...x,subscribed:false}:x))), style:{...FS,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} },'Unsub')
            )
          ))
        )
      )
    )
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

  const load = () => window.RNTECH_API.getCampaigns().then(c=>{ setCampaigns(c); setLoading(false); }).catch(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

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

  if (loading) return React.createElement(Spinner);

  return React.createElement('div', null,
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
function TabWaitlist() {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.RNTECH_API.getEvents().then(ev=>{ setEvents(ev); if(ev.length) setSelectedId(ev[0].id); }).catch(()=>{});
  },[]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    window.RNTECH_API.adminGetInterest(selectedId).then(d=>{ setInterests(d); setLoading(false); }).catch(()=>setLoading(false));
  },[selectedId]);

  const reload = () => window.RNTECH_API.adminGetInterest(selectedId).then(setInterests).catch(()=>{});

  const approve = async (id) => {
    try { await window.RNTECH_API.approveInterest(id); reload(); }
    catch(err) { alert(err.message); }
  };
  const reject = async (id) => {
    try { await window.RNTECH_API.rejectInterest(id); reload(); }
    catch(err) { alert(err.message); }
  };

  const pending = interests.filter(i=>i.status==='pending').length;
  const approved = interests.filter(i=>i.status==='approved').length;
  const rejected = interests.filter(i=>i.status==='rejected').length;
  const statusColor = { pending:'#f59e0b', approved:'#10b981', rejected:'#ef4444' };

  return React.createElement('div', null,
    React.createElement('div', { style:{display:'flex',gap:10,alignItems:'center',marginBottom:24,flexWrap:'wrap'} },
      React.createElement('select', { value:selectedId,onChange:e=>setSelectedId(e.target.value),style:{...inputSt,width:'auto',marginBottom:0,minWidth:200} },
        events.map(ev=>React.createElement('option', { key:ev.id,value:ev.id,style:{background:'#040c18'} }, ev.title))
      ),
      React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.4)',fontSize:13} }, pending+' pending · '+approved+' approved · '+rejected+' rejected')
    ),
    React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.35)',fontSize:13,marginBottom:20,lineHeight:1.6} },
      'People register interest here before you open the guest list. Approve to automatically issue them a ticket. Set an event\'s Registration Mode to "Interest Only" to enable this flow.'
    ),
    loading && React.createElement(Spinner),
    !loading && interests.length===0 && React.createElement('p', { style:{...FS,color:'rgba(255,255,255,0.3)'} }, 'No interest registrations yet for this event.'),
    !loading && interests.length>0 && React.createElement('div', { style:{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'} },
      React.createElement('table', { style:{width:'100%',borderCollapse:'collapse'} },
        React.createElement('thead', null,
          React.createElement('tr', { style:{borderBottom:'1px solid rgba(255,255,255,0.08)'} },
            ['First Name','Last Name','Email','Instagram','Submitted','Status','Action'].map(h=>
              React.createElement('th', { key:h, style:{...FS,padding:'12px 14px',textAlign:'left',color:'rgba(255,255,255,0.4)',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:600} }, h)
            )
          )
        ),
        React.createElement('tbody', null,
          interests.map((item,i)=>React.createElement('tr', { key:item.id, style:{borderBottom:'1px solid rgba(255,255,255,0.04)',background:i%2?'rgba(255,255,255,0.01)':'transparent'} },
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.9)'} }, item.firstName||item.name),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.9)'} }, item.lastName||''),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:13,color:'rgba(255,255,255,0.5)'} }, item.email),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12,color:'#6ba3d4'} }, item.instagram?'@'+item.instagram:'—'),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12,color:'rgba(255,255,255,0.3)'} }, item.createdAt.slice(0,10)),
            React.createElement('td', { style:{...FS,padding:'10px 14px',fontSize:12,color:statusColor[item.status]||'#fff',fontWeight:700,textTransform:'uppercase'} }, item.status),
            React.createElement('td', { style:{padding:'10px 14px',display:'flex',gap:6,flexWrap:'wrap'} },
              item.status==='pending' && React.createElement('button', { onClick:()=>approve(item.id), style:{...FS,background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',color:'#10b981',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Approve'),
              item.status==='pending' && React.createElement('button', { onClick:()=>reject(item.id), style:{...FS,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',padding:'4px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'} }, 'Reject'),
              item.status==='approved' && React.createElement('span', { style:{...FS,color:'#10b981',fontSize:12} }, '✓ Ticket issued'),
              item.status==='rejected' && React.createElement('span', { style:{...FS,color:'rgba(255,255,255,0.3)',fontSize:12} }, 'Rejected')
            )
          ))
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
