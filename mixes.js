export function buildMixChannel(mix,sources){
  const selected=mix.sourceIds.map(id=>sources.find(channel=>channel.channelId===id)).filter(Boolean);
  if(selected.length<2)return null;
  return {n:0,name:mix.name.toUpperCase(),color:'#d28cff',channelId:mix.id,isMix:true,mixId:mix.id,shows:selected.flatMap(source=>source.shows.map(show=>[show[0],source.name,show[2],show[3],source.channelId])).filter(show=>show[2])};
}

export function composeMixLineup(sources,mixes,lineupOrder=[]){
  const cleanSources=sources.filter(channel=>!channel.isThemed&&!channel.isMix);
  const cleanMixes=mixes.map(mix=>({...mix,sourceIds:[...new Set(Array.isArray(mix.sourceIds)?mix.sourceIds:[])].filter(id=>cleanSources.some(channel=>channel.channelId===id))})).filter(mix=>mix.sourceIds.length>=2);
  const hidden=new Set(cleanMixes.filter(mix=>mix.hideSources).flatMap(mix=>mix.sourceIds));
  const visible=[...cleanSources.filter(channel=>!hidden.has(channel.channelId)),...cleanMixes.map(mix=>buildMixChannel(mix,cleanSources)).filter(Boolean)];
  const visibleIds=new Set(visible.map(channel=>channel.channelId));
  const order=[...new Set(lineupOrder)].filter(id=>visibleIds.has(id));
  visible.forEach(channel=>{if(!order.includes(channel.channelId))order.push(channel.channelId)});
  const positions=new Map(order.map((id,index)=>[id,index]));
  const channels=visible.sort((a,b)=>positions.get(a.channelId)-positions.get(b.channelId));
  channels.forEach((channel,index)=>channel.n=index+2);
  return {sources:cleanSources,mixes:cleanMixes,channels,order};
}
