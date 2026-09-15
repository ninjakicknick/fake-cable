import {shouldShowTuningStatic} from './playback.js';

export function createPlayerController(deps){
 const {state,nowSec,currentIndex,activeCommercials,scheduleChannels,normalizeLineup,saveCommercialConfig,saveLineup,render,showGuide,showBanner,showInterstitial,hideInterstitial,showTuningStatic,hideTuningStatic,toast}=deps;
 const channels=()=>deps.getChannels();
 const sources=()=>deps.getSourceChannels();
 const commercials=()=>deps.getCommercialConfig();
 const broadcastOffset=p=>Math.max(0,Math.min(p.duration-1,Math.floor(nowSec()-p.start)));
 let unavailableTimer=null,offsetVerifyTimer=null,offsetVerifyKey='';

 function cancelUnavailableSkip(){
  clearTimeout(unavailableTimer);
  unavailableTimer=null;
  state.skippingUnavailable=false;
 }

 function cancelOffsetVerify(){
  clearTimeout(offsetVerifyTimer);
  offsetVerifyTimer=null;
  offsetVerifyKey='';
 }

 function scheduleOffsetVerify(){
  if(!state.current)return;
  const {row,p}=state.current,key=`${row}|${p.id}|${p.start}`;
  if(offsetVerifyKey===key)return;
  cancelOffsetVerify();
  offsetVerifyKey=key;
  offsetVerifyTimer=setTimeout(()=>{
   offsetVerifyTimer=null;
   if(!state.current||`${state.current.row}|${state.current.p.id}|${state.current.p.start}`!==key){offsetVerifyKey='';return;}
   const expected=broadcastOffset(state.current.p),actual=Number(state.player.getCurrentTime?.());
   if(Number.isFinite(actual)&&Math.abs(actual-expected)>5)state.player.seekTo?.(expected,true);
   // Keep the key until the next tune so repeated PLAYING callbacks from this
   // same seek cannot schedule another correction loop.
  },750);
 }

 function rebuildPausedPlayer(){
  cancelOffsetVerify();
  state.ready=false;
  try{state.player.destroy()}catch{}
  const replacement=document.createElement('div');
  replacement.id='player';
  document.querySelector('#player')?.replaceWith(replacement);
  createYouTubePlayer();
 }

 function loadCurrentProgram(){
  cancelUnavailableSkip();
  cancelOffsetVerify();
  if(!state.ready||!state.current)return;
  const {p}=state.current;
  state.player.loadVideoById({videoId:p.id,startSeconds:broadcastOffset(p)});
  if(state.muted)state.player.mute();
 }

 function resyncToBroadcast(){
  if(!state.ready||!state.current)return;
  const row=state.current.row;
  const ch=channels()[row]||state.current.ch;
  if(!ch)return;
  const index=currentIndex(ch),p=ch.schedule[index];
  if(!p)return;

  if(state.current.ch!==ch||state.current.p!==p){
   tune(row,{preserveGuide:true});
   return;
  }

  const expected=broadcastOffset(p),actual=Number(state.player.getCurrentTime?.());
  if(!Number.isFinite(actual)||Math.abs(actual-expected)>5)state.player.seekTo?.(expected,true);
  if(state.player.getPlayerState?.()===YT.PlayerState.PAUSED)state.player.playVideo?.();
 }

 function tune(row=state.row,{preserveGuide=false}={}){
  const selection={row:state.row,col:state.col,following:state.guideFollowingLive};
  const lineup=channels();
  if(!lineup.length||!Number.isInteger(row))return;
  hideInterstitial(true);
  state.guideFollowingLive=true;
  const next=((row%lineup.length)+lineup.length)%lineup.length;
  const staticNeeded=shouldShowTuningStatic(state.current,next);
  const wasPaused=state.ready&&state.player.getPlayerState?.()===YT.PlayerState.PAUSED;
  if(state.current&&next!==state.current.row)state.previousRow=state.current.row;
  state.row=next;
  const ch=lineup[state.row];
  state.col=currentIndex(ch);
  const p=ch.schedule[state.col];
  if(!p){cancelOffsetVerify();hideTuningStatic();toast('CHANNEL TEMPORARILY OFF AIR');showGuide(true);return;}
  const alreadyTuned=state.current?.row===state.row&&state.current?.p===p;
  state.current={row:state.row,index:state.col,ch,p};
  if(!alreadyTuned||wasPaused){
   cancelUnavailableSkip();
   cancelOffsetVerify();
   if(staticNeeded)showTuningStatic();
   if(wasPaused)rebuildPausedPlayer();
   else loadCurrentProgram();
  }
  if(preserveGuide&&state.guide){state.row=selection.row;state.col=selection.col;state.guideFollowingLive=selection.following;render()}
  else showGuide(false);
  if(!state.guide)showBanner();
  deps.rememberChannel?.();
 }

 function advanceAfterEnd(){
  if(!state.current)return;
  const {row,p}=state.current;
  if(nowSec()<p.end-1){
   showTuningStatic();
   return;
  }
  tune(row,{preserveGuide:true});
 }

 function skipUnavailableProgram(failed){
  unavailableTimer=null;
  state.skippingUnavailable=false;
  if(!failed||state.current?.ch!==failed.ch||state.current?.p!==failed.p)return;
  const {ch,p}=failed,channelId=ch.channelId;
  state.current=null;
  cancelOffsetVerify();
  if(p.isCommercial){
   const config=commercials();
   config.unavailableIds=[...new Set([...config.unavailableIds,p.id])];
   if(!activeCommercials().length)config.enabled=false;
   saveCommercialConfig();
   scheduleChannels();
  }else{
   const source=sources().find(channel=>channel.channelId===(ch.isMix?p.sourceChannelId:ch.channelId));
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
   state.player?.stopVideo?.();hideTuningStatic();
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
    onReady:event=>{
     if(event?.target&&event.target!==state.player)return;
     const iframe=state.player.getIframe?.();
     if(iframe)iframe.style.pointerEvents='auto';
     state.ready=true;
     loadCurrentProgram();
     deps.applyCaptions?.();
    },
    onApiChange:event=>{if(!event.target||event.target===state.player)deps.applyCaptions?.()},
    onStateChange:event=>{
     if(event.target&&event.target!==state.player)return;
     const videoId=state.player.getVideoData?.()?.video_id;
     if(videoId&&state.current&&videoId!==state.current.p.id)return;
     if(event.data===YT.PlayerState.ENDED)advanceAfterEnd();
     else if(event.data===YT.PlayerState.PLAYING&&state.current){
      const actual=state.player.getVideoData()?.video_id;
      if(actual&&actual!==state.current.p.id)loadCurrentProgram();
      else{
       scheduleOffsetVerify();
       cancelUnavailableSkip();
       deps.applyCaptions?.();
       hideTuningStatic();
       if(state.interstitialPending)hideInterstitial();
      }
     }
    },
    onError:event=>{
     if(event.target&&event.target!==state.player)return;
     const videoId=state.player.getVideoData?.()?.video_id;
     if(videoId&&state.current&&videoId!==state.current.p.id)return;
     cancelOffsetVerify();
     hideTuningStatic();
     hideInterstitial(true);
     if(event.data===153||!hosted)document.querySelector('#playback-error').style.display='flex';
     else if([2,5,100,101,150].includes(event.data)){
      if(state.skippingUnavailable||!state.current)return;
      const failed=state.current;
      state.skippingUnavailable=true;
      toast('PROGRAM UNAVAILABLE — SKIPPING AHEAD');
      unavailableTimer=setTimeout(()=>skipUnavailableProgram(failed),700);
     }else toast(`Video unavailable here (error ${event.data}) — try another channel`);
    }
   }
  });
 }

 document.addEventListener?.('visibilitychange',()=>{if(!document.hidden)resyncToBroadcast()});
 window.addEventListener?.('pageshow',resyncToBroadcast);

 return {createYouTubePlayer,loadCurrentProgram,resyncToBroadcast,tune};
}
