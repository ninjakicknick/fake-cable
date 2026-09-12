import {reflowScheduleAround,shouldShowTuningStatic} from './playback.js';

export function createPlayerController(deps){
 const {state,nowSec,currentIndex,activeCommercials,scheduleChannels,normalizeLineup,saveCommercialConfig,saveLineup,render,showGuide,showBanner,showInterstitial,hideInterstitial,showTuningStatic,hideTuningStatic,toast}=deps;
 const channels=()=>deps.getChannels();
 const sources=()=>deps.getSourceChannels();
 const commercials=()=>deps.getCommercialConfig();
 const broadcastOffset=p=>Math.max(0,Math.min(p.duration-1,Math.floor(nowSec()-p.start)));

 function rebuildPausedPlayer(){
  state.ready=false;
  try{state.player.destroy()}catch{}
  const replacement=document.createElement('div');
  replacement.id='player';
  document.querySelector('#player')?.replaceWith(replacement);
  createYouTubePlayer();
 }

 function loadCurrentProgram(){
  if(!state.ready||!state.current)return;
  const {p}=state.current;
  state.player.loadVideoById({videoId:p.id,startSeconds:broadcastOffset(p)});
  if(state.muted)state.player.mute();
 }

 function syncActualDuration(){
  if(!state.current||!state.ready)return;
  const actual=Math.round(state.player.getDuration?.()||0);
  if(actual<1)return;
  const {ch,p}=state.current;
  if(Math.abs(actual-p.duration)<=2)return;
  const played=Math.max(0,Math.min(actual-1,state.player.getCurrentTime?.()||0));
  reflowScheduleAround(ch.schedule,ch.schedule.indexOf(p),nowSec()-played,actual);
  const collection=p.isCommercial?commercials().shows:ch.isMix?sources().find(source=>source.channelId===p.sourceChannelId)?.shows:ch.shows;
  const show=collection?.find(item=>item[2]===p.id);
  if(show)show[3]=actual;
  try{
   if(p.isCommercial)saveCommercialConfig();
   else localStorage.setItem('elsewhere-channels',JSON.stringify(sources().map(({schedule,...channel})=>channel)));
  }catch{}
  if(state.guide)render();
  showBanner();
 }

 function tune(row=state.row){
  const lineup=channels();
  if(!lineup.length)return;
  hideInterstitial(true);
  state.guideFollowingLive=true;
  const next=(row+lineup.length)%lineup.length;
  const staticNeeded=shouldShowTuningStatic(state.current,next);
  const wasPaused=state.ready&&state.player.getPlayerState?.()===YT.PlayerState.PAUSED;
  if(state.current&&next!==state.row)state.previousRow=state.row;
  state.row=next;
  const ch=lineup[state.row];
  state.col=currentIndex(ch);
  const p=ch.schedule[state.col];
  const alreadyTuned=state.current?.row===state.row&&state.current?.p?.id===p.id;
  state.current={row:state.row,index:state.col,ch,p};
  if(!alreadyTuned){
   if(staticNeeded)showTuningStatic();
   if(wasPaused)rebuildPausedPlayer();
   else loadCurrentProgram();
  }
  showGuide(false);
  showBanner();
  localStorage.setItem('elsewhere-last-channel',String(state.row));
 }

 function advanceAfterEnd(){
  if(!state.current)return;
  const {row,ch,p}=state.current,index=ch.schedule.indexOf(p);
  if(index<0){tune(row);return}
  const endedAt=nowSec();
  if(endedAt<p.end-1){
   p.end=endedAt;
   let cursor=endedAt;
   for(let i=index+1;i<ch.schedule.length;i++){
    ch.schedule[i].start=cursor;
    ch.schedule[i].end=cursor+ch.schedule[i].duration;
    cursor=ch.schedule[i].end;
   }
  }
  const nextIndex=Math.min(index+1,ch.schedule.length-1),next=ch.schedule[nextIndex];
  state.row=row;
  state.col=nextIndex;
  state.current={row,index:nextIndex,ch,p:next};
  if(state.guide)render();
  else if(next.isCommercial)hideInterstitial(true);
  else showInterstitial(ch,next);
  loadCurrentProgram();
 }

 function skipUnavailableProgram(){
  if(!state.current){state.skippingUnavailable=false;return}
  const {ch,p}=state.current,channelId=ch.channelId;
  if(p.isCommercial){
   const config=commercials();
   config.unavailableIds=[...new Set([...config.unavailableIds,p.id])];
   if(!activeCommercials().length)config.enabled=false;
   saveCommercialConfig();
   scheduleChannels();
  }else{
   const source=ch.isMix?sources().find(channel=>channel.channelId===p.sourceChannelId):ch;
   if(source){
    source.unavailableIds=[...new Set([...(source.unavailableIds||[]),p.id])];
    source.shows=source.shows.filter(show=>show[2]!==p.id);
   }
   normalizeLineup();
   saveLineup();
  }
  const lineup=channels(),tuned=lineup.findIndex(channel=>channel.channelId===channelId),target=lineup[tuned];
  state.current=null;
  state.skippingUnavailable=false;
  if(!target?.shows?.length){
   toast('CHANNEL TEMPORARILY OFF AIR');
   showGuide(true);
   return;
  }
  tune(Math.max(0,tuned));
 }

 function createYouTubePlayer(){
  const hosted=/^https?:$/.test(location.protocol);
  document.querySelector('#player-shield')?.remove();
  state.player=new YT.Player('player',{
   width:'100%',height:'100%',
   playerVars:{autoplay:1,controls:0,disablekb:1,fs:0,iv_load_policy:3,modestbranding:1,rel:0,playsinline:1,...(hosted?{origin:location.origin}:{})},
   events:{
    onReady:()=>{
     const iframe=state.player.getIframe?.();
     if(iframe)iframe.style.pointerEvents='auto';
     state.ready=true;
     loadCurrentProgram();
    },
    onStateChange:event=>{
     if(event.data===YT.PlayerState.ENDED)advanceAfterEnd();
     else if(event.data===YT.PlayerState.PLAYING&&state.current){
      const actual=state.player.getVideoData()?.video_id;
      if(actual&&actual!==state.current.p.id)loadCurrentProgram();
      else{
       hideTuningStatic();
       syncActualDuration();
       if(state.interstitialPending)hideInterstitial();
      }
     }
    },
    onError:event=>{
     hideTuningStatic();
     hideInterstitial(true);
     if(event.data===153||!hosted)document.querySelector('#playback-error').style.display='flex';
     else if([2,5,100,101,150].includes(event.data)){
      if(state.skippingUnavailable)return;
      state.skippingUnavailable=true;
      toast('PROGRAM UNAVAILABLE — SKIPPING AHEAD');
      setTimeout(skipUnavailableProgram,700);
     }else toast(`Video unavailable here (error ${event.data}) — try another channel`);
    }
   }
  });
 }

 return {createYouTubePlayer,loadCurrentProgram,tune};
}
