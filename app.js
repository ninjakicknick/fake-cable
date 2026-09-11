import {currentIndexAt,makeSchedule} from './schedule.js';
import {createPlayerController} from './player.js';
import {createTuningStatic} from './tuning-static.js';
import {createRemoteController} from './remote.js';
import {decodeLineup,encodeLineup} from './lineup-share.js';
import {composeMixLineup} from './mixes.js';
import {isDirectYouTubeInput,stationLabelAfterFetch} from './channel-input.js';
import {createGuideController} from './guide.js';
import {CATALOG_VERSION,LINEUP_VERSION,STORAGE_KEYS,loadCommercialConfig,loadLineupOrder,loadMixes,loadSourceChannels,saveLineupState} from './storage.js';

const remoteParams=new URLSearchParams(location.search);
const isPhoneRemote=remoteParams.has('remote');
if(isPhoneRemote)document.body.classList.add('remote-mode');

let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  document.querySelector('#install-app')?.classList.remove('hidden');
});
window.addEventListener('appinstalled',()=>{
  installPrompt=null;
  document.querySelector('#install-app')?.classList.add('hidden');
});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
const DEFAULT_STATIONS=[
 {value:'https://www.youtube.com/playlist?list=PLRmpOEZ5F1SA',label:'Weird Animation',tags:['animation','weird']},
 {value:'https://www.youtube.com/playlist?list=PLTkogaZu8Kn0',label:'Horror Shorts',tags:['horror']},
 {value:'https://www.youtube.com/playlist?list=PLbBSn4qd5pFE',label:'Documentaries',tags:['documentary']},
 {value:'https://youtube.com/@bobross_thejoyofpainting',label:'Bob Ross',tags:[]},
 {value:'https://youtube.com/@supersaturdaymorning',label:'Super Saturday Morning',tags:['animation']}
];
const DEFAULT_COMMERCIAL_PLAYLIST={
 value:'https://www.youtube.com/playlist?list=PLVKuQ0TpzAbfIbgfIAQOQs9Y7e6dRjknw',
 label:'Classic TV Commercials'
};
const DEMO_CHANNELS=[
 {n:2,name:'WEIRD ANIMATION',channelId:'playlist:PLRmpOEZ5F1SA',playlistId:'PLRmpOEZ5F1SA',color:'#b18cff',shows:[
  ['DISTORTION. A Stop motion Animation by Guldies','Guldies','tZqIQmdSa1E',105],
  ['DOUBLE KING','Felix Colgrave','w_MSFkZHNi4',587],
  ['late for meeting','David Lewandowski','wBqM2ytqHY4',102],
  ['CGI Animated Short Film: "Don\'t Croak" by Daun Kim | CGMeetup','CGMeetup','j8PDTJNaPc0',101],
  ['Fantasy Haircut','DoodletmeGO','P6uwj5Ix7qg',315],
  ['Fuelled | Animated Short Film 2021','Killedthecat Productions','uVzT6D-yhZg',543],
  ['where_did_life_go','Doctor Nowhere','0DVdDa0qKoc',150],
  ['Best Friend - Animation Short Film 2018 - GOBELINS','GOBELINS Paris','j01Hg4QJ6NE',347],
  ['cat city','vewn','NWeyUpqnKuk',181],
  ['Coda','and maps and plans','MkA3sLyEWdU',541],
  ['A Brief Disagreement','Steve Cutts','9x7FGbW3IVc',186],
  ['Pinched','Titmouse','oWlhMekUZRs',675]
 ]},
 {n:3,name:'HORROR SHORTS',channelId:'playlist:PLTkogaZu8Kn0',playlistId:'PLTkogaZu8Kn0',color:'#ed6a5a',shows:[
  ['Other Side of the Box | Award-Winning Horror Short Film','Short of the Week','TGZg1YqXv9o',950],
  ['Portrait of God (Short Horror Film)','Dylan Clark','BI9fKfX5V68',450],
  ['POSSIBLY IN MICHIGAN (1983)','ceceliacondit','iLJNSD3H5sg',706],
  ['THE CHAIR (Award Winning Horror Short Film Directed by Curry Barker)',"that's a bad idea",'mhazCS14Tas',1463],
  ['This House Has People in It','Adult Swim','x-pj8OtyO2I',715],
  ['Unedited Footage of a Bear | Infomercials | Adult Swim','Adult Swim','2gMjJNGg9Z8',629],
  ['Too Many Cooks | Adult Swim','Adult Swim','QrGrOK8oZG8',672],
  ['GUEST — A Horror Short Film by Finn Callan','Finn Callan','7-5Upq2hcOA',678],
  ['THE SKY - AWARD WINNING COSMIC HORROR','Matt Sears','ln4lDjT8Ab0',674],
  ['Mama Agnes - Short Horror Film','Alexanderthetitan','IfgesY42oN8',165],
  ['Horror Short Film “Backstroke” | ALTER','ALTER','3_DQmfFjTlU',622],
  ['SCP: Containment Breach - The Movie | SCP-173 Live Action','Keter Labs','Fw4lLEfgQuo',715],
  ['The Flying Man','Marcus Alqueres','Gj1MqHgFnmE',561],
  ['Not My Dog | Horror Short Film','CIAK COMPANY','_QlUUb5UMvA',327]
 ]},
 {n:4,name:'DOCUMENTARIES',channelId:'playlist:PLbBSn4qd5pFE',playlistId:'PLbBSn4qd5pFE',color:'#63a7ff',shows:[
  ["SATAN'S GUIDE TO THE BIBLE",'SATANSGUIDE','z8j3HvmgpYc',5151],
  ["MyHouse.WAD - Inside Doom's Most Terrifying Mod",'Power Pak','5wAo54DHDY0',6121],
  ["TaeKwonDo Rockers vs. Cocaine-Dealing Ninjas: The True Story of 'Miami Connection'",'VICE','z1UmZ4WWspo',1395],
  ["The Incredibly Strange, Sad Story Behind The World's Most Ambitious Demo Tape",'VICE','1pI24MkekW8',1574],
  ["On The Road with The World's Most Hyperactive Horror Director",'VICE','c62Ot4L7m94',1496],
  ["The Worst Movie Ever Made? The True Story of 'Birdemic'",'VICE','uZoFNVhEfpE',1589],
  ['The Mayhem of Jason Miller | Dark Side Of The Cage','VICE and 2 more','3Zc5SrQuZXY',2669],
  ["SoCal Skate History And Eating At Tony Hawk's Place with Lizzie Armanto",'VICE','SRkP2ewEWMU',1037],
  ['The Series That Changed Skateboarding Forever | Let It Kill You','VICE','ZL5l9iEI0uE',2734],
  ['Rule Britannia: Inside Britain’s Shoplifting Epidemic','VICE','fJOeJ-BqjCg',1266]
 ]},
 {n:5,name:'BOB ROSS',channelId:'UCxcnsr1R5Ge_fbTu5ajt8DQ',color:'#75d887',shows:[
  ['Gladiolus with CRI® Doug Hallgren | Brush Strokes','Bob Ross','BIEppZQRNWk',1884],
  ['Bob Ross - One Hour Special - Peace Offerings of Summer','Bob Ross','NDpKTkdRBu0',3545],
  ["Ellen's Beach with CRI® Nicholas Hankins | Brush Strokes",'Bob Ross','LRpaBxkYqaU',2909],
  ["Brush Strokes Table Talk | Episode 11 | Bob Ross' Most Iconic Quotes",'Bob Ross','kyW35uDde84',1325],
  ['Twilight Meadow with CRI® Doug Hallgren | Brush Strokes','Bob Ross','PqJQc4BVgUE',1973],
  ['Happy Little Threes: Summer Bob | Episode 82 | The Joy of Bob Ross: A Happy Little Podcast®','Bob Ross','twH7MR2QJK8',1579],
  ['Daffodil with CRI® Carolyn Saletto | Brush Strokes','Bob Ross','ShEx_7hlCfk',2430],
  ['Bob Ross: Top 10 Summer Paintings','Bob Ross','Uk9BksOB8a4',15430],
  ['A Day at the Beach with CRI® Nicholas Hankins | Brush Strokes','Bob Ross','HbGMWmAR2gk',1750],
  ["A Few Of Bob's Favorite Things | Episode 81 | The Joy of Bob Ross: A Happy Little Podcast®",'Bob Ross','OmgZ49F9O8k',1292],
  ['Brush Strokes Table Talk | Episode 10 | Painting Inspiration','Bob Ross','KGYpu61BGAA',1509],
  ['Peachy Rose with CRI® Doug Hallgren | Brush Strokes','Bob Ross','EL5C1TWKWYU',2358]
 ]}
];
let SOURCE_CHANNELS=loadSourceChannels(localStorage,DEMO_CHANNELS);
let CHANNELS=[];
let mixes=loadMixes(localStorage);
const commercialDefaults={enabled:true,value:DEFAULT_COMMERCIAL_PLAYLIST.value,label:DEFAULT_COMMERCIAL_PLAYLIST.label,shows:[],unavailableIds:[],updatedAt:0};
let {config:commercialConfig,shouldLoadDefault:shouldLoadDefaultCommercials}=loadCommercialConfig(localStorage,commercialDefaults);
const state={row:0,col:0,guide:true,guideStart:0,guideFollowingLive:true,guideCurrentSignature:'',player:null,ready:false,current:null,previousRow:null,muted:false,bannerTimer:null,remoteTimer:null,interstitialTimer:null,interstitialShownAt:0,interstitialPending:false,skippingUnavailable:false,upNextKey:'',peer:null,remoteConnection:null,pairKey:'',pairUrl:'',staticFrame:0,staticMinUntil:0,staticAudio:null,staticAudioContext:null,staticHideTimer:null,staticStartedAt:0};
const {showTuningStatic,hideTuningStatic}=createTuningStatic({state});
function activeCommercials(){return commercialConfig.enabled?commercialConfig.shows.filter(show=>!commercialConfig.unavailableIds.includes(show[2])):[]}
function scheduleChannels(){const commercials=activeCommercials();CHANNELS.forEach(c=>c.schedule=makeSchedule(c,{commercials}))}
function normalizeLineup(){const composed=composeMixLineup(SOURCE_CHANNELS,mixes,lineupOrder);SOURCE_CHANNELS=composed.sources;mixes=composed.mixes;CHANNELS=composed.channels;lineupOrder=composed.order;scheduleChannels()}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nowSec=()=>Date.now()/1000;
function currentIndex(ch){return currentIndexAt(ch,nowSec())}
function fmtClock(s){return new Date(s*1000).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
const {broadcastRemoteStatus,openPairing,copyRemoteLink,disconnectRemote,initPhoneRemote}=createRemoteController({
 state,
 getChannels:()=>CHANNELS,
 remoteParams,
 nowSec,
 esc,
 isDirectYouTubeInput,
 handleTvAction:action=>{startTelevision();performAction(action)},
 handleAddChannel:(value,label)=>{startTelevision();addStation(value,label,{fromRemote:true})}
});
const {render,updateGuideNowLine,updateGuideProgramProgress,updateGuideProgramTextPins,updateSelection}=createGuideController({getChannels:()=>CHANNELS,state,nowSec,currentIndex,fmtClock,esc,broadcastRemoteStatus});
const {createYouTubePlayer,loadCurrentProgram,tune}=createPlayerController({
 state,
 getChannels:()=>CHANNELS,
 getSourceChannels:()=>SOURCE_CHANNELS,
 getCommercialConfig:()=>commercialConfig,
 nowSec,
 currentIndex,
 activeCommercials,
 scheduleChannels,
 normalizeLineup,
 saveCommercialConfig,
 saveLineup,
 render,
 showGuide,
 showBanner,
 showInterstitial,
 hideInterstitial,
 showTuningStatic,
 hideTuningStatic,
 toast
});
function showInterstitial(ch,p){const panel=document.querySelector('#interstitial');clearTimeout(state.interstitialTimer);state.interstitialShownAt=Date.now();state.interstitialPending=true;panel.style.setProperty('--station-color',ch.color||'#52d9db');document.querySelector('#interstitial-title').textContent=p.title;document.querySelector('#interstitial-channel').textContent=`CH ${String(ch.n).padStart(2,'0')}`;document.querySelector('#interstitial-station').textContent=ch.name;panel.classList.add('show');state.interstitialTimer=setTimeout(()=>hideInterstitial(),6000)}
function hideInterstitial(force=false){const panel=document.querySelector('#interstitial');clearTimeout(state.interstitialTimer);if(!panel.classList.contains('show')){state.interstitialPending=false;return}const wait=force?0:Math.max(0,1400-(Date.now()-state.interstitialShownAt));state.interstitialTimer=setTimeout(()=>{panel.classList.remove('show');const announce=state.interstitialPending;state.interstitialPending=false;if(announce&&!state.guide)showBanner()},wait)}
function showGuide(on){state.guide=on;document.querySelector('#guide').classList.toggle('hidden',!on);if(on){render();updateSelection(true);document.querySelector('#grid-scroll').focus()}broadcastRemoteStatus()}
function showBanner(){if(!state.current)return;const {ch,p}=state.current,b=document.querySelector('#banner');clearTimeout(state.bannerTimer);if(p.isCommercial){b.classList.remove('show');broadcastRemoteStatus();return}const elapsed=Math.max(0,nowSec()-p.start);document.querySelector('#banner-channel').textContent=`CH ${String(ch.n).padStart(2,'0')}  ·  ${ch.name}`;document.querySelector('#banner-title').textContent=p.title;document.querySelector('#banner-meta').textContent=`${p.source}  ·  ${Math.floor(elapsed/60)} MINUTES INTO PROGRAM`;document.querySelector('#banner-progress').style.width=Math.min(100,elapsed/p.duration*100)+'%';b.classList.add('show');state.bannerTimer=setTimeout(()=>b.classList.remove('show'),4200);broadcastRemoteStatus()}
function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1500)}
function setMuted(on){state.muted=on;if(state.ready){on?state.player.mute():state.player.unMute()}toast(on?'MUTED':'SOUND ON');broadcastRemoteStatus()}
function performAction(action){
 if(action==='pair'){openPairing();return}
 if(action==='controls'){setRemoteMinimized(!document.querySelector('#remote').classList.contains('minimized'));return}
 scheduleRemoteHide();
 if(action==='guide')showGuide(!state.guide);
 else if(action==='up')tune(state.row+1);
 else if(action==='down')tune(state.row-1);
 else if(action==='watch')tune(state.row);
 else if(action==='settings')openSetup();
 else if(action==='mute')setMuted(!state.muted);
 else if(action==='last'){if(state.previousRow===null)toast('NO PREVIOUS CHANNEL');else tune(state.previousRow)}
 else if(action==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>toast('FULLSCREEN BLOCKED BY BROWSER'))}
 else if(action==='banner')showBanner();
 else if(action==='nav-up'){if(state.guide){state.row=(state.row-1+CHANNELS.length)%CHANNELS.length;state.col=currentIndex(CHANNELS[state.row]);state.guideFollowingLive=true;render();updateSelection()}else tune(state.row+1)}
 else if(action==='nav-down'){if(state.guide){state.row=(state.row+1)%CHANNELS.length;state.col=currentIndex(CHANNELS[state.row]);state.guideFollowingLive=true;render();updateSelection()}else tune(state.row-1)}
 else if(action==='nav-left'&&state.guide)stepProgram(-1);
 else if(action==='nav-right'&&state.guide)stepProgram(1);
 else if(action.startsWith('channel:')){const row=Number(action.slice(8));if(Number.isInteger(row)&&CHANNELS[row])tune(row)}
 broadcastRemoteStatus();
}
function setRemoteMinimized(on){const remote=document.querySelector('#remote'),button=remote.querySelector('.minimize');remote.classList.toggle('minimized',on);button.textContent=on?'REMOTE':'−';button.setAttribute('aria-label',on?'Show on-screen controls':'Minimize on-screen controls');button.title=on?'Show controls':'Minimize controls';clearTimeout(state.remoteTimer);if(!on)scheduleRemoteHide()}
function scheduleRemoteHide(){clearTimeout(state.remoteTimer);if(document.querySelector('#welcome').style.display!=='none'||document.querySelector('#setup').style.display==='block')return;state.remoteTimer=setTimeout(()=>setRemoteMinimized(true),8000)}
function reactToOnscreenRemote(action,button){button?.classList.add('pressed');setTimeout(()=>button?.classList.remove('pressed'),130);navigator.vibrate?.(action==='watch'?[12,24,12]:action==='up'||action==='down'?24:14)}
function stepProgram(dir){state.guideFollowingLive=false;const ch=CHANNELS[state.row],current=ch.schedule[state.col];let next=Math.max(0,Math.min(ch.schedule.length-1,state.col+dir));if(dir>0&&current?.commercialBreakId)while(next<ch.schedule.length&&ch.schedule[next]?.commercialBreakId===current.commercialBreakId)next++;if(dir<0&&ch.schedule[next]?.commercialBreakId){const breakId=ch.schedule[next].commercialBreakId;while(next>0&&ch.schedule[next-1]?.commercialBreakId===breakId)next--}state.col=Math.max(0,Math.min(ch.schedule.length-1,next));render()}
function tick(){const d=new Date();document.querySelector('#time').textContent=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});document.querySelector('#date').textContent=d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}).toUpperCase();if(state.guide){const guideStart=Math.floor(nowSec()/900)*900-900,current=currentIndex(CHANNELS[state.row]),signature=CHANNELS.map(currentIndex).join('|'),selectionAdvanced=state.guideFollowingLive&&current!==state.col;if(current===state.col)state.guideFollowingLive=true;if(selectionAdvanced)state.col=current;if(guideStart!==state.guideStart||signature!==state.guideCurrentSignature){render();if(selectionAdvanced)updateSelection(true)}else{updateGuideNowLine();updateGuideProgramProgress()}}if(!state.current)return;const remaining=state.current.p.end-nowSec();if(remaining<=0){state.upNextKey='';tune(state.row);return}const {ch,p}=state.current,index=ch.schedule.indexOf(p),next=ch.schedule[index+1],key=`${ch.channelId||ch.name}:${p.id}:${p.start}`;if(next&&!next.isCommercial&&remaining<=60&&state.upNextKey!==key){state.upNextKey=key;toast(`UP NEXT · ${next.title}`)}}
const setupStatus=msg=>document.querySelector('#setup-status').textContent=msg;
let stationPicker=[];
let lineupOrder=loadLineupOrder(localStorage);
let stationUpdating=false;
let editingMixId=null;
try{stationPicker=JSON.parse(localStorage.getItem('fake-cable-stations')||'null')||(localStorage.getItem('elsewhere-channel-links')||'').split(/\r?\n/).filter(Boolean).map(value=>({value,label:value,tags:[]}));if(localStorage.getItem(STORAGE_KEYS.lineupVersion)!==LINEUP_VERSION&&stationPicker.length<30){const existing=new Set(stationPicker.map(station=>station.value)),room=30-stationPicker.length;stationPicker=[...stationPicker,...structuredClone(DEFAULT_STATIONS).filter(station=>!existing.has(station.value)).slice(0,room)]}if(!stationPicker.length)stationPicker=structuredClone(DEFAULT_STATIONS);normalizeLineup()}catch{}
function openSetup(){document.querySelector('#setup').style.display='block';setupStatus('');document.querySelector('#search-results').innerHTML='';renderStationPicker();renderMixes();renderCommercialSettings()}
function closeSetup(){document.querySelector('#setup').style.display='none';closeMixEditor()}
function saveCommercialConfig(){localStorage.setItem('fake-cable-commercials',JSON.stringify(commercialConfig))}
function commercialSummary(){const available=commercialConfig.shows.filter(show=>!commercialConfig.unavailableIds.includes(show[2]));if(shouldLoadDefaultCommercials&&!commercialConfig.shows.length)return 'Included commercials are loading…';if(!commercialConfig.shows.length)return 'Commercials are off.';return `${commercialConfig.label||'Commercial playlist'} · ${available.length} commercial${available.length===1?'':'s'} · ${commercialConfig.enabled?'On':'Off'}`}
function renderCommercialSettings(){const enabled=document.querySelector('#commercials-enabled'),input=document.querySelector('#commercial-playlist'),remove=document.querySelector('#remove-commercials');enabled.checked=Boolean(commercialConfig.enabled&&commercialConfig.shows.length);enabled.disabled=!commercialConfig.shows.length;input.value=commercialConfig.value||'';document.querySelector('#commercial-status').textContent=commercialSummary();remove.classList.toggle('hidden',!commercialConfig.shows.length)}
function applyCommercialSchedule(){const tunedRow=state.current?.row,stateWasTuned=Boolean(state.current);scheduleChannels();if(stateWasTuned&&CHANNELS[tunedRow]){state.row=tunedRow;state.col=currentIndex(CHANNELS[tunedRow]);const ch=CHANNELS[tunedRow],p=ch.schedule[state.col];state.current={row:tunedRow,index:state.col,ch,p};loadCurrentProgram()}if(state.guide)render();broadcastRemoteStatus()}
async function ensureDefaultCommercialPlaylist(){if(!shouldLoadDefaultCommercials)return;try{const channel=await fetchStationChannel(DEFAULT_COMMERCIAL_PLAYLIST.value);if(localStorage.getItem('fake-cable-commercials')!==null)return;if(!channel.playlistId||!channel.shows.length)throw new Error('The included commercial playlist is unavailable.');commercialConfig={enabled:true,value:DEFAULT_COMMERCIAL_PLAYLIST.value,label:channel.name||DEFAULT_COMMERCIAL_PLAYLIST.label,shows:channel.shows.map(video=>[video.title,video.source||channel.name,video.id,video.duration]),unavailableIds:[],updatedAt:Date.now()};shouldLoadDefaultCommercials=false;saveCommercialConfig();applyCommercialSchedule();renderCommercialSettings()}catch(error){console.warn('Could not load included commercials:',error)}}
async function loadCommercialPlaylist(){if(stationUpdating)return;const input=document.querySelector('#commercial-playlist'),button=document.querySelector('#save-commercials'),value=input.value.trim();if(!value){document.querySelector('#commercial-status').textContent='Paste a YouTube playlist link first.';return}stationUpdating=true;button.disabled=true;document.querySelector('#commercial-status').textContent='Loading commercial playlist…';try{const channel=await fetchStationChannel(value);if(!channel.playlistId)throw new Error('Commercials must come from a YouTube playlist.');commercialConfig={enabled:true,value,label:channel.name||'Commercial playlist',shows:channel.shows.map(video=>[video.title,video.source||channel.name,video.id,video.duration]),unavailableIds:[],updatedAt:Date.now()};saveCommercialConfig();applyCommercialSchedule();renderCommercialSettings();document.querySelector('#commercial-status').textContent=`${commercialConfig.shows.length} commercials loaded and turned on.`}catch(error){document.querySelector('#commercial-status').textContent=error.message}finally{stationUpdating=false;button.disabled=false}}
function channelSummary(channel){if(!channel)return 'Not loaded yet';const seconds=channel.shows.reduce((sum,show)=>sum+(Number(show[3])||0),0),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);const age=channel.updatedAt?Math.max(0,Math.floor((Date.now()-channel.updatedAt)/86400000)):null;const updated=age===null?'Update pending':age===0?'Updated today':age===1?'Updated yesterday':`Updated ${age} days ago`;return `${channel.shows.length} videos · ${hours?hours+'h ':''}${minutes}m · ${channel.refreshError?'Refresh failed—using saved lineup':updated}`}
function stationDisplayName(station,index){return station.customLabel||station.label||SOURCE_CHANNELS[index]?.sourceName||SOURCE_CHANNELS[index]?.name||'Untitled channel'}
function syncCurrentChannel(channelId){const row=CHANNELS.findIndex(channel=>channel.channelId===channelId);if(row<0){state.current=null;state.row=Math.min(state.row,CHANNELS.length-1);return}state.row=row;state.col=currentIndex(CHANNELS[row]);if(state.current){const ch=CHANNELS[row],p=ch.schedule[state.col];state.current={row,index:state.col,ch,p}}}
function moveGuideChannel(index,direction){const target=index+direction;if(stationUpdating||target<0||target>=CHANNELS.length)return;const activeId=state.current?.ch.channelId||CHANNELS[state.row]?.channelId,moved=CHANNELS[index];[lineupOrder[index],lineupOrder[target]]=[lineupOrder[target],lineupOrder[index]];normalizeLineup();saveLineup();syncCurrentChannel(activeId);renderStationPicker();renderMixes();if(state.guide)render();broadcastRemoteStatus();setupStatus(`${moved.name} moved to channel ${target+2}.`)}
function renameStation(index){if(stationUpdating)return;const station=stationPicker[index],channel=SOURCE_CHANNELS[index];if(!station||!channel)return;const current=stationDisplayName(station,index),answer=window.prompt('Rename this channel. Leave it blank to restore the original name.',current);if(answer===null)return;const customLabel=answer.trim();station.customLabel=customLabel||'';channel.sourceName=channel.sourceName||channel.name;channel.customName=customLabel||'';channel.name=(customLabel||channel.sourceName).toUpperCase();normalizeLineup();saveLineup();renderStationPicker();renderMixes();if(state.guide)render();broadcastRemoteStatus();setupStatus(customLabel?`Channel renamed to ${customLabel}.`:'Original channel name restored.')}
function renameGuideChannel(index){const channel=CHANNELS[index];if(!channel)return;if(channel.isMix){const mix=mixes.find(item=>item.id===channel.mixId),answer=window.prompt('Rename this mix channel.',mix?.name||channel.name);if(answer===null)return;const name=answer.trim();if(!name){setupStatus('A mix channel needs a name.');return}mix.name=name;normalizeLineup();saveLineup();renderStationPicker();renderMixes();if(state.guide)render();broadcastRemoteStatus();setupStatus(`Channel renamed to ${name}.`);return}const sourceIndex=SOURCE_CHANNELS.findIndex(item=>item.channelId===channel.channelId);renameStation(sourceIndex)}
function hiddenByMix(channelId){return mixes.filter(mix=>mix.hideSources&&mix.sourceIds.includes(channelId)).map(mix=>mix.name)}
function renderGuideLineup(){const box=document.querySelector('#guide-lineup-list');document.querySelector('#guide-lineup-count').textContent=`ON THE GUIDE · ${CHANNELS.length}`;box.innerHTML=CHANNELS.map((channel,index)=>`<div class="station-item guide-lineup-item"><div class="station-position"><button data-guide-move="${index}:-1" aria-label="Move ${esc(channel.name)} up" ${stationUpdating||index===0?'disabled':''}>▲</button><span>CH ${String(index+2).padStart(2,'0')}</span><button data-guide-move="${index}:1" aria-label="Move ${esc(channel.name)} down" ${stationUpdating||index===CHANNELS.length-1?'disabled':''}>▼</button></div><div class="station-copy"><strong>${esc(channel.name)}</strong><div class="station-details">${channel.isMix?'MIX CHANNEL':'SOURCE STATION'}</div></div><button data-guide-rename="${index}" ${stationUpdating?'disabled':''}>RENAME</button></div>`).join('')}
function renderStationPicker(){renderGuideLineup();const box=document.querySelector('#station-list');document.querySelector('#station-count').textContent=`SOURCE STATIONS · ${stationPicker.length}/30`;box.innerHTML=stationPicker.length?stationPicker.map((station,index)=>{const hidden=hiddenByMix(SOURCE_CHANNELS[index]?.channelId);return `<div class="station-item"><div class="station-copy"><strong>${esc(stationDisplayName(station,index))}</strong><div class="station-details">${hidden.length?`HIDDEN BY ${esc(hidden.join(', '))} · `:''}${esc(channelSummary(SOURCE_CHANNELS[index]))}</div></div><button data-rename="${index}" ${stationUpdating?'disabled':''}>RENAME</button><button data-refresh="${index}" ${stationUpdating?'disabled':''}>REFRESH</button><button data-remove="${index}" ${stationUpdating?'disabled':''}>REMOVE</button></div>`}).join(''):'<div class="setup-note">You’re using the starter lineup.</div>'}
function renderMixes(){const box=document.querySelector('#mix-list');document.querySelector('#mix-count').textContent=`MIX STATIONS · ${mixes.length}`;box.innerHTML=mixes.length?mixes.map(mix=>{const names=mix.sourceIds.map(id=>SOURCE_CHANNELS.find(channel=>channel.channelId===id)?.name).filter(Boolean);return `<div class="mix-item"><div class="mix-copy"><strong>${esc(mix.name)}</strong><small>${esc(names.join(', '))}</small><span>${mix.hideSources?'REPLACES SOURCE STATIONS':'KEEPS SOURCE STATIONS'}</span></div><button data-edit-mix="${mix.id}">EDIT</button><button data-remove-mix="${mix.id}">REMOVE</button></div>`}).join(''):'<div class="setup-note">Combine two or more stations into one channel without cluttering the guide.</div>'}
function openMixEditor(id=null){const mix=mixes.find(item=>item.id===id);editingMixId=mix?.id||null;document.querySelector('#mix-editor-title').textContent=mix?'Edit mix':'Create a mix';document.querySelector('#mix-name').value=mix?.name||'';document.querySelector('#mix-hide-sources').checked=mix?.hideSources??true;document.querySelector('#mix-source-list').innerHTML=SOURCE_CHANNELS.map(channel=>`<label><input type="checkbox" value="${esc(channel.channelId)}" ${mix?.sourceIds.includes(channel.channelId)?'checked':''}><span>${esc(channel.name)}</span></label>`).join('');document.querySelector('#mix-editor').classList.remove('hidden');document.querySelector('#mix-name').focus()}
function closeMixEditor(){editingMixId=null;document.querySelector('#mix-editor')?.classList.add('hidden');document.querySelector('#mix-error').textContent=''}
function saveMix(){const name=document.querySelector('#mix-name').value.trim(),sourceIds=[...document.querySelectorAll('#mix-source-list input:checked')].map(input=>input.value),error=document.querySelector('#mix-error');if(!name){error.textContent='Give the channel a name.';return}if(sourceIds.length<2){error.textContent='Choose at least two source stations.';return}const mix={id:editingMixId||`mix:${Date.now().toString(36)}`,name,sourceIds,hideSources:document.querySelector('#mix-hide-sources').checked};if(editingMixId)mixes=mixes.map(item=>item.id===editingMixId?mix:item);else mixes.push(mix);normalizeLineup();saveLineup();state.row=Math.min(state.row,CHANNELS.length-1);state.current=null;closeMixEditor();renderStationPicker();renderMixes();if(state.guide)render();broadcastRemoteStatus()}
async function fetchStationChannel(value) {
  const res=await fetch('/api/channels',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({channels:[value]})});
  const data=await res.json();
  if(!res.ok||!data.channels?.length)throw new Error(data.error||'Could not build that channel.');
  return data.channels[0];
}
function channelFromApi(channel,index,existing=null) {
  const colors=['#52d9db','#ed6a5a','#f2bd56','#b18cff','#ff779d','#75d887','#63a7ff','#f58f54'],unavailableIds=existing?.unavailableIds||[];
  const sourceName=channel.name.toUpperCase(),customName=existing?.customName||'';
  return {n:index+2,name:(customName||sourceName).toUpperCase(),sourceName,customName,channelId:channel.channelId,playlistId:channel.playlistId||null,color:existing?.color||colors[index%colors.length],shows:channel.shows.filter(v=>!unavailableIds.includes(v.id)).map(v=>[v.title,v.source||channel.name,v.id,v.duration]),unavailableIds,updatedAt:Date.now(),lastAttemptAt:Date.now(),refreshError:false};
}
function saveLineup(){saveLineupState(localStorage,{stationPicker,sourceChannels:SOURCE_CHANNELS,mixes,lineupOrder});document.querySelector('#lineup-status').textContent=`${CHANNELS.length} stations`}
async function addStation(value,label=value,{fromRemote=false}={}){const report=(message,busy=false,added=false)=>{setupStatus(message);if(fromRemote&&state.remoteConnection?.open)state.remoteConnection.send({type:'channel-status',message,busy,added})};if(stationUpdating){report('Fake Cable is already updating the lineup. Try again in a moment.');return}if(stationPicker.length>=30){report('The cable package is full at 30 channels.');return}if(stationPicker.some(s=>s.value===value)){report('That channel is already in your lineup.');return}stationUpdating=true;const wasEmpty=!stationPicker.length;stationPicker.push({value,label,tags:[]});renderStationPicker();document.querySelector('#search-channel').disabled=true;report(`Adding ${label}…`,true);try{const channel=await fetchStationChannel(value),resolvedLabel=stationLabelAfterFetch(stationPicker.at(-1),channel.name);stationPicker.at(-1).label=resolvedLabel;if(wasEmpty)SOURCE_CHANNELS=[];const built=channelFromApi(channel,SOURCE_CHANNELS.length);SOURCE_CHANNELS.push(built);normalizeLineup();saveLineup();report(`${resolvedLabel} added to the TV lineup.`,false,true)}catch(err){stationPicker.pop();renderStationPicker();report(err.message)}finally{stationUpdating=false;document.querySelector('#search-channel').disabled=false;renderStationPicker();renderMixes();broadcastRemoteStatus()}}
async function refreshStation(index,{quiet=false}={}){const station=stationPicker[index],existing=SOURCE_CHANNELS[index];if(!station||!existing)return false;if(!quiet){stationUpdating=true;renderStationPicker();setupStatus(`Refreshing ${station.label}…`)}try{const channel=await fetchStationChannel(station.value),updated=channelFromApi(channel,index,existing);station.label=stationLabelAfterFetch(station,channel.name);SOURCE_CHANNELS[index]=updated;normalizeLineup();saveLineup();state.current=null;if(!quiet)setupStatus(`${station.label} refreshed.`);if(state.guide)render();return true}catch(err){existing.lastAttemptAt=Date.now();existing.refreshError=true;saveLineup();if(!quiet)setupStatus(`Could not refresh ${station.label}. Keeping its saved lineup.`);return false}finally{if(!quiet){stationUpdating=false;document.querySelector('#search-channel').disabled=false;renderStationPicker();renderMixes()}}}
async function refreshStaleChannels(){if(stationUpdating)return;for(let i=0;i<stationPicker.length;i++){const channel=SOURCE_CHANNELS[i];if(!channel||Date.now()-(channel.updatedAt||0)<86400000)continue;await refreshStation(i,{quiet:true});renderStationPicker();if(i<stationPicker.length-1)await new Promise(resolve=>setTimeout(resolve,500))}}
async function searchChannel(){const input=document.querySelector('#channel-search'),query=input.value.trim();if(!query){setupStatus('Type a creator name or paste a YouTube link.');return}if(isDirectYouTubeInput(query)){addStation(query,query);input.value='';return}const button=document.querySelector('#search-channel');button.disabled=true;setupStatus(`Searching YouTube for “${query}”…`);try{const res=await fetch('/api/channels',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'search',query})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Search failed.');document.querySelector('#search-results').innerHTML=data.results.map(r=>`<div class="search-result"><img src="${esc(r.thumb)}" alt=""><strong>${esc(r.title)}</strong><button data-add-url="${esc(r.url)}" data-add-label="${esc(r.title)}">ADD</button></div>`).join('');setupStatus(`${data.results.length} channel results.`)}catch(err){setupStatus(err.message)}finally{button.disabled=false}}
async function buildChannels(successMessage='Lineup updated.'){if(stationUpdating)return;stationUpdating=true;renderStationPicker();document.querySelector('#search-channel').disabled=true;try{if(!stationPicker.length){SOURCE_CHANNELS=structuredClone(DEMO_CHANNELS);mixes=[];normalizeLineup();localStorage.removeItem('fake-cable-disabled-themes');localStorage.removeItem('fake-cable-mixes');localStorage.removeItem('elsewhere-channel-links');localStorage.removeItem('elsewhere-channels');localStorage.removeItem('fake-cable-stations');localStorage.removeItem('fake-cable-lineup-version');document.querySelector('#lineup-status').textContent='Starter lineup ready'}else{const rebuilt=[],workingStations=[],total=stationPicker.length;let failed=0;for(let i=0;i<total;i++){const station=stationPicker[i];setupStatus(`Refreshing channel ${i+1} of ${total}…`);document.querySelector('#lineup-status').textContent=`Refreshing channel ${i+1} of ${total}…`;try{const channel=await fetchStationChannel(station.value);station.label=stationLabelAfterFetch(station,channel.name);rebuilt.push(channelFromApi(channel,rebuilt.length,SOURCE_CHANNELS[i]));workingStations.push(station)}catch{failed++;const saved=SOURCE_CHANNELS[i];if(saved?.shows?.length){saved.n=rebuilt.length+2;saved.refreshError=true;saved.lastAttemptAt=Date.now();rebuilt.push(saved);workingStations.push(station)}}if(i<total-1)await new Promise(resolve=>setTimeout(resolve,250))}if(!rebuilt.length)throw new Error('YouTube could not refresh any channels right now. Your saved lineup was not changed.');stationPicker=workingStations;SOURCE_CHANNELS=rebuilt;normalizeLineup();saveLineup();if(failed)successMessage+=` ${failed} channel${failed===1?'':'s'} could not refresh, so saved programming was kept.`}state.row=Math.min(state.row,CHANNELS.length-1);state.col=currentIndex(CHANNELS[state.row]);state.current=null;state.previousRow=null;setupStatus(`${successMessage} Opening the guide…`);setTimeout(()=>{closeSetup();showGuide(true)},500);return true}catch(err){setupStatus(err.message);return false}finally{stationUpdating=false;document.querySelector('#search-channel').disabled=false;renderStationPicker();renderMixes()}}
window.onYouTubeIframeAPIReady=createYouTubePlayer;
let sharedUrl='',incoming=null;function modal(v){document.querySelector('#lineup-modal').style.display='block';document.querySelector('#share-lineup-view').classList.toggle('hidden',v!=='share');document.querySelector('#import-lineup-view').classList.toggle('hidden',v!=='import')}function shareLineup(){try{const es=SOURCE_CHANNELS.map((c,i)=>[c.channelId,stationDisplayName(stationPicker[i]||{},i)]).filter(x=>x[0]);sharedUrl=`${location.origin}${location.pathname}#lineup=${encodeLineup(es)}`;const q=document.querySelector('#lineup-qr');q.innerHTML='';new QRCode(q,{text:sharedUrl,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});document.querySelector('#native-share-lineup').classList.toggle('hidden',!navigator.share);modal('share')}catch(e){setupStatus(e.message)}}function incomingLineup(d){incoming=d.channels;history.replaceState(null,'',location.pathname+location.search);document.querySelector('#lineup-modal-title').textContent='Shared lineup found';document.querySelector('#import-lineup-summary').textContent=`${incoming.length} channels are ready. Add missing channels or replace this device’s lineup.`;document.querySelector('#incoming-lineup-list').innerHTML=incoming.map((x,i)=>`<div class="incoming-item"><span class="incoming-number">${i+1}</span><span class="incoming-name">${esc(x[1])}</span></div>`).join('');modal('import')}async function importLineup(mode){if(stationUpdating)return;const ids=new Set(SOURCE_CHANNELS.map(c=>c.channelId)),todo=mode==='add'?incoming.filter(x=>!ids.has(x[0])):incoming,status=document.querySelector('#import-lineup-status');if(!todo.length){status.textContent='Every shared channel is already here.';return}stationUpdating=true;const keep=mode==='add'&&stationPicker.length,ns=keep?[...stationPicker]:[],nc=keep?[...SOURCE_CHANNELS]:[];let failed=0;for(let i=0;i<todo.length;i++){status.textContent=`Loading channel ${i+1} of ${todo.length}…`;try{const c=await fetchStationChannel(todo[i][0]),customLabel=todo[i][1]&&todo[i][1]!==c.name?todo[i][1]:'';ns.push({value:todo[i][0],label:c.name,customLabel});const built=channelFromApi(c,nc.length);if(customLabel){built.customName=customLabel;built.name=customLabel.toUpperCase()}nc.push(built)}catch{failed++}}stationUpdating=false;const added=ns.length-(keep?stationPicker.length:0);if(!added){status.textContent='YouTube could not load these channels. Your lineup was not changed.';return}stationPicker=ns.slice(0,30);SOURCE_CHANNELS=nc.slice(0,30);if(mode!=='add')mixes=[];normalizeLineup();saveLineup();state.row=0;state.current=null;status.textContent=`${added} imported${failed?`, ${failed} skipped`:''}.`;setTimeout(()=>document.querySelector('#lineup-modal').style.display='none',900)}

document.querySelector('#install-app').onclick=async()=>{
  if(!installPrompt)return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt=null;
  document.querySelector('#install-app').classList.add('hidden');
};
function startTelevision(){if(document.querySelector('#welcome').style.display==='none')return;showTuningStatic(800);document.querySelector('#welcome').style.display='none';const last=Number(localStorage.getItem(STORAGE_KEYS.lastChannel)||0);state.row=Math.min(CHANNELS.length-1,Math.max(0,last));render();tune(state.row);scheduleRemoteHide()}
document.querySelector('#start').onclick=startTelevision;
document.querySelector('#welcome-pair').onclick=openPairing;
document.querySelector('#settings-pair').onclick=openPairing;
document.querySelector('#grid').addEventListener('click',e=>{const tuneTarget=e.target.closest('[data-tune]');if(tuneTarget){tune(Number(tuneTarget.dataset.tune));return}const card=e.target.closest('.program');if(!card)return;state.row=Number(card.dataset.row);state.col=Number(card.dataset.col);const isNow=state.col===currentIndex(CHANNELS[state.row]);state.guideFollowingLive=isNow;render();if(isNow)tune(state.row)});
document.querySelector('#remote').addEventListener('click',e=>{const button=e.target.closest('button'),action=button?.dataset.action;if(action){reactToOnscreenRemote(action,button);performAction(action)}});
document.querySelector('#remote').addEventListener('pointermove',()=>{if(!document.querySelector('#remote').classList.contains('minimized'))scheduleRemoteHide()});
document.querySelector('#close-setup').onclick=closeSetup;
document.querySelector('#close-pair').onclick=()=>document.querySelector('#pair-modal').style.display='none';
document.querySelector('#copy-remote-link').onclick=copyRemoteLink;
document.querySelector('#disconnect-remote').onclick=disconnectRemote;
document.querySelector('#back-to-guide').onclick=()=>{document.querySelector('#playback-error').style.display='none';showGuide(true)};
document.querySelector('#back-to-tv').onclick=()=>{if(state.current)showGuide(false);else tune(state.row)};
document.querySelector('#search-channel').onclick=searchChannel;
document.querySelector('#save-commercials').onclick=loadCommercialPlaylist;
document.querySelector('#commercials-enabled').onchange=event=>{if(!commercialConfig.shows.length){event.target.checked=false;return}commercialConfig.enabled=event.target.checked;saveCommercialConfig();applyCommercialSchedule();renderCommercialSettings()};
document.querySelector('#remove-commercials').onclick=()=>{commercialConfig={enabled:false,value:'',label:'',shows:[],unavailableIds:[],updatedAt:0};saveCommercialConfig();applyCommercialSchedule();renderCommercialSettings()};
document.querySelector('#share-lineup').onclick=shareLineup;document.querySelector('#about-help').onclick=()=>document.querySelector('#about-modal').style.display='block';document.querySelector('#close-about').onclick=()=>document.querySelector('#about-modal').style.display='none';document.querySelector('#close-lineup-modal').onclick=()=>document.querySelector('#lineup-modal').style.display='none';document.querySelector('#copy-lineup-link').onclick=()=>navigator.clipboard.writeText(sharedUrl);document.querySelector('#native-share-lineup').onclick=()=>navigator.share?.({title:'Fake Cable lineup',url:sharedUrl});document.querySelector('#add-shared-lineup').onclick=()=>importLineup('add');document.querySelector('#replace-with-shared-lineup').onclick=()=>importLineup('replace');document.querySelector('#clear-stations').onclick=()=>{if(stationUpdating||!window.confirm('Restore the starter lineup?\n\nThis removes every personal channel and mix you added. This cannot be undone.'))return;mixes=[];stationPicker=structuredClone(DEFAULT_STATIONS);renderStationPicker();buildChannels('Starter lineup restored.')};
document.querySelector('#search-results').addEventListener('click',e=>{const button=e.target.closest('[data-add-url]');if(button)addStation(button.dataset.addUrl,button.dataset.addLabel)});
document.querySelector('#guide-lineup-list').addEventListener('click',e=>{const move=e.target.closest('[data-guide-move]');if(move){const [index,direction]=move.dataset.guideMove.split(':').map(Number);moveGuideChannel(index,direction);return}const rename=e.target.closest('[data-guide-rename]');if(rename)renameGuideChannel(Number(rename.dataset.guideRename))});
document.querySelector('#station-list').addEventListener('click',e=>{const rename=e.target.closest('[data-rename]');if(rename){renameStation(Number(rename.dataset.rename));return}const refresh=e.target.closest('[data-refresh]');if(refresh&&!stationUpdating){refreshStation(Number(refresh.dataset.refresh));return}const button=e.target.closest('[data-remove]');if(!button||stationUpdating)return;const index=Number(button.dataset.remove),removed=SOURCE_CHANNELS[index];stationPicker.splice(index,1);SOURCE_CHANNELS.splice(index,1);mixes=mixes.map(mix=>({...mix,sourceIds:mix.sourceIds.filter(id=>id!==removed?.channelId)}));if(!stationPicker.length){stationPicker=structuredClone(DEFAULT_STATIONS);buildChannels('Starter lineup restored.');return}normalizeLineup();saveLineup();state.row=Math.min(state.row,CHANNELS.length-1);state.col=currentIndex(CHANNELS[state.row]);state.current=null;renderStationPicker();renderMixes();setupStatus('Channel removed.');showGuide(true)});
document.querySelector('#create-mix').onclick=()=>openMixEditor();
document.querySelector('#cancel-mix').onclick=closeMixEditor;
document.querySelector('#save-mix').onclick=saveMix;
document.querySelector('#mix-list').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-mix]'),remove=e.target.closest('[data-remove-mix]');if(edit){openMixEditor(edit.dataset.editMix);return}if(!remove)return;mixes=mixes.filter(mix=>mix.id!==remove.dataset.removeMix);normalizeLineup();saveLineup();state.row=Math.min(state.row,CHANNELS.length-1);state.current=null;renderMixes();if(state.guide)render();broadcastRemoteStatus()});
document.addEventListener('keydown',e=>{if(isPhoneRemote)return;if(document.querySelector('#welcome').style.display!=='none'){if(e.key==='Enter')document.querySelector('#start').click();return}if(document.querySelector('#setup').style.display==='block'){if(e.key==='Enter'&&document.activeElement===document.querySelector('#channel-search'))searchChannel();return}const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','enter'].includes(k))e.preventDefault();if(k==='g'||k==='escape')performAction('guide');else if(k==='f')performAction('fullscreen');else if(k==='m')performAction('mute');else if(state.guide){if(k==='arrowup')performAction('nav-up');if(k==='arrowdown')performAction('nav-down');if(k==='arrowleft')performAction('nav-left');if(k==='arrowright')performAction('nav-right');if(k==='enter')performAction('watch')}else{if(k==='arrowup')performAction('up');if(k==='arrowdown')performAction('down');if(k==='enter'||k===' ')performAction('banner')}});
document.querySelector('#lineup-status').textContent=CHANNELS.some(c=>c.channelId)?`${CHANNELS.length} personal channels ready`:'Demo lineup · open Settings to add your channels';
if(!isPhoneRemote&&stationPicker.length&&localStorage.getItem('fake-cable-lineup-version')!==LINEUP_VERSION){document.querySelector('#lineup-status').textContent='Adding new starter channels…';buildChannels('Your lineup has been expanded.')}
else if(!isPhoneRemote&&stationPicker.length&&localStorage.getItem(STORAGE_KEYS.catalogVersion)!==CATALOG_VERSION){document.querySelector('#lineup-status').textContent='Refreshing video filters…';buildChannels('Your stations have refreshed video filters.')}
let renderTimer=null,guideLabelFrame=null;const rerenderGuide=()=>{clearTimeout(renderTimer);renderTimer=setTimeout(()=>{if(state.guide)render()},100)};const pinGuideLabels=()=>{if(guideLabelFrame)return;guideLabelFrame=requestAnimationFrame(()=>{guideLabelFrame=null;updateGuideProgramTextPins()})};window.addEventListener('resize',rerenderGuide);window.addEventListener('orientationchange',rerenderGuide);document.addEventListener('fullscreenchange',rerenderGuide);document.querySelector('#grid-scroll').addEventListener('scroll',pinGuideLabels,{passive:true});
const shared=decodeLineup(location.hash);if(shared?.channels)incomingLineup(shared);else if(shared?.error)document.querySelector('#lineup-status').textContent=shared.error;
if(isPhoneRemote){initPhoneRemote()}else{ensureDefaultCommercialPlaylist();setInterval(tick,1000);setInterval(broadcastRemoteStatus,3000);tick();render();setTimeout(refreshStaleChannels,6000);const api=document.createElement('script');api.src='https://www.youtube.com/iframe_api';document.head.appendChild(api)}
