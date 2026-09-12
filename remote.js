export function createRemoteController({
 state,
 getChannels,
 remoteParams,
 nowSec,
 esc,
 isDirectYouTubeInput,
 handleTvAction,
 handleAddChannel
}){
 function remoteSnapshot(){
  const channels=getChannels();
  const ch=state.current?.ch||channels[state.row];
  const p=state.current?.p||ch?.schedule?.[state.col];
  return {
   type:'status',
   channelNumber:ch?.n||'',
   channelName:ch?.name||'',
   channelColor:ch?.color||'#52d9db',
   title:p?.title||'Nothing tuned yet',
   source:p?.source||'',
   elapsed:p?Math.max(0,nowSec()-p.start):0,
   duration:p?.duration||0,
   guide:state.guide,
   muted:state.muted,
   selectedChannel:state.current?.row??state.row,
   channels:channels.map((channel,row)=>({row,n:channel.n,name:channel.name}))
  };
 }

 function broadcastRemoteStatus(){
  if(state.remoteConnection?.open)state.remoteConnection.send(remoteSnapshot());
 }

 function randomPairKey(){
  const bytes=crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g,'');
 }

 function setPairStatus(message,connected=false){
  document.querySelector('#pair-status').textContent=message;
  document.querySelector('#disconnect-remote').classList.toggle('hidden',!connected);
 }

 async function copyRemoteLink(){
  if(!state.pairUrl){setPairStatus('REMOTE LINK IS STILL BEING CREATED…');return}
  try{
   await navigator.clipboard.writeText(state.pairUrl);
   setPairStatus('REMOTE LINK COPIED — OPEN IT IN ANOTHER BROWSER');
  }catch{
   setPairStatus('COULD NOT COPY LINK — TRY SCANNING THE CODE');
  }
 }

 function openPairing(){
  document.querySelector('#pair-modal').style.display='block';
  if(state.remoteConnection?.open){setPairStatus('PHONE CONNECTED',true);return}
  if(state.peer&&!state.peer.destroyed){
   if(state.peer.disconnected){
    setPairStatus('RESTORING REMOTE CONNECTION…');
    try{state.peer.reconnect()}catch{}
   }else setPairStatus(state.pairUrl?'READY TO SCAN':'CREATING A PRIVATE CONNECTION…');
   return;
  }
  if(typeof Peer==='undefined'){setPairStatus('REMOTE SERVICE COULD NOT LOAD — CHECK THE CONNECTION');return}
  state.pairKey=randomPairKey();
  state.peer=new Peer();
  setPairStatus('CREATING A PRIVATE CONNECTION…');
  state.peer.on('open',id=>{
   state.pairUrl=`${location.origin}${location.pathname}?remote=${encodeURIComponent(id)}&key=${encodeURIComponent(state.pairKey)}`;
   const qr=document.querySelector('#pair-qr');
   qr.innerHTML='';
   new QRCode(qr,{text:state.pairUrl,width:240,height:240,correctLevel:QRCode.CorrectLevel.M});
   document.querySelector('#copy-remote-link').classList.remove('hidden');
   setPairStatus('READY TO SCAN OR COPY');
  });
  state.peer.on('connection',connection=>{
   if(connection.metadata?.key!==state.pairKey){connection.close();return}
   state.remoteConnection?.close();
   state.remoteConnection=connection;
   connection.on('open',()=>{
    document.body.classList.add('remote-paired');
    setPairStatus('PHONE CONNECTED',true);
    connection.send(remoteSnapshot());
    setTimeout(()=>document.querySelector('#pair-modal').style.display='none',900);
   });
   connection.on('data',data=>{
    if(data?.type==='action'&&typeof data.action==='string')handleTvAction(data.action);
    else if(data?.type==='add-channel'&&typeof data.value==='string')handleAddChannel(data.value,data.label||data.value);
   });
   connection.on('close',()=>{
    if(state.remoteConnection===connection)state.remoteConnection=null;
    document.body.classList.remove('remote-paired');
    setPairStatus('PHONE DISCONNECTED — WAITING TO RECONNECT');
   });
   connection.on('error',()=>setPairStatus('CONNECTION LOST — WAITING TO RECONNECT'));
  });
  state.peer.on('disconnected',()=>{
   setPairStatus('RESTORING REMOTE CONNECTION…');
   setTimeout(()=>{
    if(state.peer?.disconnected&&!state.peer.destroyed)try{state.peer.reconnect()}catch{}
   },1000);
  });
  state.peer.on('error',error=>{
   if(error?.type==='network'||error?.type==='server-error'){
    setPairStatus('REMOTE NETWORK INTERRUPTED — RECONNECTING…');
    setTimeout(()=>{
     if(state.peer?.disconnected&&!state.peer.destroyed)try{state.peer.reconnect()}catch{}
    },2000);
   }else setPairStatus('COULD NOT CREATE REMOTE — TRY AGAIN');
  });
 }

 function disconnectRemote(){
  state.remoteConnection?.close();
  state.peer?.destroy();
  state.remoteConnection=null;
  state.peer=null;
  state.pairUrl='';
  document.body.classList.remove('remote-paired');
  document.querySelector('#pair-qr').innerHTML='';
  document.querySelector('#copy-remote-link').classList.add('hidden');
  setPairStatus('DISCONNECTED');
 }

 function renderPhoneStatus(data){
  const connected=document.querySelector('#phone-connection');
  const remote=document.querySelector('#phone-remote');
  connected.textContent='CONNECTED';
  connected.classList.add('connected');
  remote.style.setProperty('--station-color',data.channelColor||'#52d9db');
  document.querySelector('#phone-channel').textContent=`CH ${String(data.channelNumber).padStart(2,'0')} · ${data.channelName}`;
  const title=document.querySelector('#phone-title');
  const titleText=title.querySelector('span');
  if(titleText.textContent!==data.title){
   title.classList.remove('scrolling');
   titleText.textContent=data.title;
   titleText.style.removeProperty('--marquee-distance');
   requestAnimationFrame(()=>{
    const overflow=Math.max(0,titleText.scrollWidth-title.clientWidth);
    titleText.style.setProperty('--marquee-distance',`-${overflow+28}px`);
    titleText.style.setProperty('--marquee-duration',`${Math.max(8,Math.min(18,overflow/18+6))}s`);
    title.classList.toggle('scrolling',overflow>2);
   });
  }
  document.querySelector('#phone-meta').textContent=`${data.source}${data.guide?' · GUIDE OPEN':''}${data.muted?' · MUTED':''}`;
  document.querySelector('#phone-progress').style.width=(data.duration?Math.min(100,data.elapsed/data.duration*100):0)+'%';
  const picker=document.querySelector('#phone-channel-picker');
  const signature=data.channels.map(channel=>`${channel.row}:${channel.name}`).join('|');
  if(picker.dataset.signature!==signature){
   picker.innerHTML='';
   data.channels.forEach(channel=>{
    const option=document.createElement('option');
    option.value=channel.row;
    option.textContent=`${String(channel.n).padStart(2,'0')}  ${channel.name}`;
    picker.appendChild(option);
   });
   picker.dataset.signature=signature;
  }
  picker.value=String(data.selectedChannel);
  picker.disabled=false;
 }

 const phoneActionDetails={
  guide:['feature','GUIDE'],
  banner:['feature','PROGRAM INFO'],
  watch:['tune','TUNED IN'],
  last:['utility','LAST CHANNEL'],
  mute:['utility','SOUND TOGGLED'],
  up:['channel','CHANNEL UP'],
  down:['channel','CHANNEL DOWN'],
  'nav-up':['nav','UP'],
  'nav-down':['nav','DOWN'],
  'nav-left':['nav','PREVIOUS'],
  'nav-right':['nav','NEXT']
 };

 function reactToPhoneAction(action,button){
  const remote=document.querySelector('#phone-remote');
  const response=document.querySelector('#phone-response');
  const [tone,label]=phoneActionDetails[action]||['feature','SENT'];
  remote.dataset.reaction=tone;
  response.textContent=label;
  response.classList.remove('pop');
  void response.offsetWidth;
  response.classList.add('pop');
  button?.classList.add('pressed');
  setTimeout(()=>button?.classList.remove('pressed'),130);
  navigator.vibrate?.(action==='watch'?[12,24,12]:action==='up'||action==='down'?24:14);
 }

 function setPhoneChannelStatus(message,busy=false){
  const status=document.querySelector('#phone-channel-status');
  const input=document.querySelector('#phone-channel-search');
  const button=document.querySelector('#phone-search-channel');
  status.textContent=message;
  input.disabled=busy;
  button.disabled=busy;
 }

 function clearPhoneSearchResults(){
  const box=document.querySelector('#phone-search-results');
  box.innerHTML='';
  box.onclick=null;
  document.querySelector('#phone-channel-search').value='';
 }

 function renderPhoneSearchResults(results,connection){
  const box=document.querySelector('#phone-search-results');
  box.innerHTML=results.map(result=>`<div class="phone-search-result"><img src="${esc(result.thumb)}" alt=""><strong>${esc(result.title)}</strong><button data-phone-add-url="${esc(result.url)}" data-phone-add-label="${esc(result.title)}">ADD</button></div>`).join('')+'<button class="phone-search-close" data-phone-close-results>BACK TO REMOTE</button>';
  box.onclick=event=>{
   if(event.target.closest('[data-phone-close-results]')){
    clearPhoneSearchResults();
    setPhoneChannelStatus('Search by name or paste a channel, playlist, or video link.');
    return;
   }
   const button=event.target.closest('[data-phone-add-url]');
   if(!button||!connection.open)return;
   connection.send({type:'add-channel',value:button.dataset.phoneAddUrl,label:button.dataset.phoneAddLabel});
   setPhoneChannelStatus(`Adding ${button.dataset.phoneAddLabel}…`,true);
  };
 }

 async function searchPhoneChannel(connection){
  const input=document.querySelector('#phone-channel-search');
  const query=input.value.trim();
  if(!query){setPhoneChannelStatus('Type a creator name or paste a YouTube link.');return}
  if(isDirectYouTubeInput(query)){
   connection.send({type:'add-channel',value:query,label:query});
   setPhoneChannelStatus('Adding channel to the TV lineup…',true);
   input.value='';
   return;
  }
  setPhoneChannelStatus(`Searching YouTube for “${query}”…`,true);
  try{
   const response=await fetch('/api/channels',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'search',query})
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Search failed.');
   renderPhoneSearchResults(data.results,connection);
   setPhoneChannelStatus(`${data.results.length} channel results.`);
  }catch(error){
   setPhoneChannelStatus(error.message);
  }
 }

 function initPhoneRemote(){
  const target=remoteParams.get('remote');
  const key=remoteParams.get('key');
  const connectionLabel=document.querySelector('#phone-connection');
  let peer=null,connection=null,retryTimer=null,retryAttempt=0,lastStatusAt=0,connecting=false;
  const controls=document.querySelectorAll('[data-phone-action]');
  const setConnected=connected=>{
   controls.forEach(button=>button.disabled=!connected);
   document.querySelector('#phone-search-channel').disabled=!connected;
   if(!connected)document.querySelector('#phone-channel-picker').disabled=true;
  };
  const showReconnecting=message=>{
   connectionLabel.textContent=message;
   connectionLabel.classList.remove('connected');
   setConnected(false);
  };
  const scheduleReconnect=(delay=null)=>{
   clearTimeout(retryTimer);
   if(document.hidden||!navigator.onLine)return;
   const wait=delay??Math.min(15000,1000*2**Math.min(retryAttempt++,4));
   retryTimer=setTimeout(connect,wait);
  };
  const handleData=data=>{
   if(data?.type==='status'){
    lastStatusAt=Date.now();
    renderPhoneStatus(data);
   }else if(data?.type==='channel-status'){
    if(data.added)clearPhoneSearchResults();
    setPhoneChannelStatus(data.message,data.busy);
   }
  };
  const attachConnection=next=>{
   connection=next;
   next.on('open',()=>{
    if(connection!==next)return;
    connecting=false;
    retryAttempt=0;
    lastStatusAt=Date.now();
    connectionLabel.textContent='CONNECTED';
    connectionLabel.classList.add('connected');
    setConnected(true);
   });
   next.on('data',handleData);
   next.on('close',()=>{
    if(connection!==next)return;
    connection=null;
    connecting=false;
    showReconnecting('RECONNECTING TO TV…');
    scheduleReconnect();
   });
   next.on('error',()=>{
    if(connection!==next)return;
    showReconnecting('CONNECTION LOST — RECONNECTING…');
    scheduleReconnect();
   });
  };
  const connect=()=>{
   clearTimeout(retryTimer);
   if(document.hidden||!navigator.onLine||connection?.open||connecting)return;
   showReconnecting(retryAttempt?'RECONNECTING TO TV…':'CONNECTING TO TV…');
   if(!peer||peer.destroyed){
    connecting=true;
    peer=new Peer();
    peer.on('open',()=>{connecting=false;connect()});
    peer.on('disconnected',()=>{
     connecting=false;
     showReconnecting('RECONNECTING TO TV…');
     try{peer.reconnect()}catch{scheduleReconnect()}
    });
    peer.on('error',()=>{
     connecting=false;
     showReconnecting('TV NOT FOUND — RETRYING…');
     scheduleReconnect();
    });
    return;
   }
   if(peer.disconnected){
    connecting=true;
    try{peer.reconnect()}catch{connecting=false;scheduleReconnect()}
    return;
   }
   if(!peer.open){scheduleReconnect();return}
   connecting=true;
   attachConnection(peer.connect(target,{reliable:true,metadata:{key}}));
  };
  const recover=()=>{
   if(document.hidden||!navigator.onLine)return;
   if(connection?.open&&Date.now()-lastStatusAt<10000)return;
   if(connection){
    const stale=connection;
    connection=null;
    stale.close();
   }
   connecting=false;
   retryAttempt=0;
   connect();
  };
  setConnected(false);
  const remote=document.querySelector('#phone-remote');
  const addPanel=document.querySelector('#phone-add-channel');
  const addToggle=document.querySelector('#phone-add-toggle');
  const fullscreenButton=document.querySelector('#phone-fullscreen');
  const setAddPanelOpen=open=>{
   addPanel.classList.toggle('open',open);
   addPanel.setAttribute('aria-hidden',String(!open));
   addToggle.setAttribute('aria-expanded',String(open));
   if(open)setTimeout(()=>document.querySelector('#phone-channel-search').focus(),0);
   else clearPhoneSearchResults();
  };
  const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const syncFullscreenButton=()=>{
   const active=Boolean(fullscreenElement());
   fullscreenButton.textContent=active?'EXIT':'FULL';
   fullscreenButton.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');
   remote.classList.toggle('is-fullscreen',active);
  };
  const toggleFullscreen=async()=>{
   try{
    if(fullscreenElement())await (document.exitFullscreen?.()||document.webkitExitFullscreen?.());
    else await (remote.requestFullscreen?.({navigationUI:'hide'})||remote.webkitRequestFullscreen?.());
   }catch{
    fullscreenButton.textContent='NO FULL';
    setTimeout(syncFullscreenButton,1200);
   }
  };
  addToggle.addEventListener('click',()=>setAddPanelOpen(!addPanel.classList.contains('open')));
  document.querySelector('#phone-add-close').addEventListener('click',()=>setAddPanelOpen(false));
  fullscreenButton.addEventListener('click',toggleFullscreen);
  document.addEventListener('fullscreenchange',syncFullscreenButton);
  document.addEventListener('webkitfullscreenchange',syncFullscreenButton);
  syncFullscreenButton();
  if(!target||!key||typeof Peer==='undefined'){
   connectionLabel.textContent='INVALID REMOTE LINK';
   return;
  }
  document.querySelector('#phone-remote').addEventListener('click',event=>{
   const button=event.target.closest('[data-phone-action]');
   const action=button?.dataset.phoneAction;
   if(action&&connection?.open){
    reactToPhoneAction(action,button);
    connection.send({type:'action',action});
   }
  });
  document.querySelector('#phone-channel-picker').addEventListener('change',event=>{
   if(connection?.open){
    reactToPhoneAction('watch');
    connection.send({type:'action',action:`channel:${event.target.value}`});
   }
  });
  document.querySelector('#phone-search-channel').addEventListener('click',()=>{
   if(connection?.open)searchPhoneChannel(connection);
  });
  document.querySelector('#phone-channel-search').addEventListener('keydown',event=>{
   if(event.key==='Enter'&&connection?.open)searchPhoneChannel(connection);
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)recover()});
  window.addEventListener('pageshow',recover);
  window.addEventListener('online',recover);
  setInterval(()=>{
   if(!document.hidden&&(!connection?.open||Date.now()-lastStatusAt>12000))recover();
  },5000);
  connect();
 }

 return {broadcastRemoteStatus,openPairing,copyRemoteLink,disconnectRemote,initPhoneRemote};
}
