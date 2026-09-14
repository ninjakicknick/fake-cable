import {makeSchedule,currentIndexAt} from './schedule.js';

// Rebuild only changed/expired schedules. Keep selection attached to channel
// identities, but always derive the broadcast itself from shared channel data
// and wall-clock time so separate Fake Cable instances agree on what's airing.
export function createLineupScheduler(){
 let cache=new Map();
 return function reconcile(state,previous,channels,commercials=[],now=Date.now()/1000){
  const selectedId=previous[state.row]?.channelId;
  const previousId=previous[state.previousRow]?.channelId;
  const current=state.current;
  const nextCache=new Map();
  for(const channel of channels){
   const signature=JSON.stringify([channel.shows,commercials]);
   const saved=cache.get(channel.channelId);
   const valid=saved?.signature===signature&&saved.schedule[0]?.start<=now&&saved.schedule.at(-1)?.end>now+5400;
   channel.schedule=valid?saved.schedule:makeSchedule(channel,{date:new Date(now*1000),commercials});
   nextCache.set(channel.channelId,{signature,schedule:channel.schedule});
  }
  cache=nextCache;
  const selected=channels.findIndex(channel=>channel.channelId===selectedId);
  state.row=selected>=0?selected:Math.max(0,Math.min(state.row,channels.length-1));
  state.col=currentIndexAt(channels[state.row],now);
  const last=channels.findIndex(channel=>channel.channelId===previousId);
  state.previousRow=last<0?null:last;
  if(!current)return false;
  const row=channels.findIndex(channel=>channel.channelId===current.ch.channelId);
  const ch=channels[row>=0?row:state.row];
  const index=ch?currentIndexAt(ch,now):0,p=ch?.schedule[index];
  state.current=p?{row:row>=0?row:state.row,index,ch,p}:null;
  return state.current?.p!==current.p;
 };
}
