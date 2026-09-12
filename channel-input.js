export function isDirectYouTubeInput(value){
  return /(?:youtube\.com|youtu\.be|^@)/i.test(value.trim());
}

export function stationLabelAfterFetch(station,fetchedName){
  const value=String(station?.value||'').trim();
  const label=String(station?.label||'').trim();
  const resolved=String(fetchedName||'').trim();
  return resolved&&(!label||label===value)?resolved:(label||resolved||value);
}

export async function fetchStationChannel(value){
  const res=await fetch('/api/channels',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({channels:[value]})});
  const data=await res.json();
  if(!res.ok||!data.channels?.length)throw new Error(data.error||'Could not build that channel.');
  return data.channels[0];
}

export async function searchStationChannels(query){
  const res=await fetch('/api/channels',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'search',query})});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||'Search failed.');
  return data.results;
}

export function channelFromApi(channel,index,existing=null){
  const colors=['#52d9db','#ed6a5a','#f2bd56','#b18cff','#ff779d','#75d887','#63a7ff','#f58f54'],unavailableIds=existing?.unavailableIds||[];
  const sourceName=channel.name.toUpperCase(),customName=existing?.customName||'';
  return {n:index+2,name:(customName||sourceName).toUpperCase(),sourceName,customName,channelId:channel.channelId,playlistId:channel.playlistId||null,color:existing?.color||colors[index%colors.length],shows:channel.shows.filter(v=>!unavailableIds.includes(v.id)).map(v=>[v.title,v.source||channel.name,v.id,v.duration]),unavailableIds,updatedAt:Date.now(),lastAttemptAt:Date.now(),refreshError:false};
}
