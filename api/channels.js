const YOUTUBE = 'https://www.youtube.com';
const HEADERS = {'user-agent':'Mozilla/5.0 (compatible; FakeCable/1.0)','accept-language':'en-US,en;q=0.9'};

function decodeXml(value='') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}

async function getText(url, timeout=7000) {
  let lastError;
  for(let attempt=0;attempt<3;attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),timeout);
    const retryUrl=attempt&&url.includes('/feeds/videos.xml')?`${url}${url.includes('?')?'&':'?'}retry=${Date.now()}-${attempt}`:url;
    try {
      const result = await fetch(retryUrl,{headers:HEADERS,redirect:'follow',signal:controller.signal});
      if(result.ok)return await result.text();
      lastError=new Error(`YouTube returned ${result.status}`);
      if(result.status!==429&&result.status<500)throw lastError;
    } catch(error) {
      lastError=error?.name==='AbortError'?new Error('YouTube took too long to respond.'):error;
    } finally { clearTimeout(timer); }
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }
  throw lastError||new Error('YouTube did not respond.');
}

async function resolveChannel(input) {
  const raw=String(input||'').trim();
  const direct=raw.match(/(?:channel\/)?(UC[A-Za-z0-9_-]{20,})/);
  if(direct) return direct[1];
  let path=raw;
  let videoId='';
  try {
    const u=new URL(raw.includes('://')?raw:`https://youtube.com/${raw.replace(/^\//,'')}`);
    if(/(^|\.)youtu\.be$/.test(u.hostname)){videoId=u.pathname.split('/').filter(Boolean)[0]||'';path=`/watch?v=${videoId}`}
    else if(/(^|\.)youtube\.com$/.test(u.hostname)){path=u.pathname+u.search;videoId=u.searchParams.get('v')||''}
    else throw 0;
  } catch { throw new Error(`Not a YouTube link: ${raw}`); }
  if(videoId||/^\/(?:shorts|live)\//.test(path)){
    if(!videoId)videoId=path.split('/')[2]?.split('?')[0]||'';
    const html=await getText(`${YOUTUBE}/watch?v=${encodeURIComponent(videoId)}`);
    const found=html.match(/"videoDetails":\{[\s\S]{0,8000}?"channelId":"(UC[A-Za-z0-9_-]+)"/);
    if(!found)throw new Error(`Could not identify the creator of that video.`);
    return found[1];
  }
  if(!/^\/(?:@|c\/|user\/)/.test(path))throw new Error(`Use a channel, @handle, or video link: ${raw}`);
  const html=await getText(`${YOUTUBE}${path}`);
  const found=html.match(/"channelMetadataRenderer":\{[\s\S]{0,12000}?"externalId":"(UC[A-Za-z0-9_-]+)"/)||html.match(/"externalId":"(UC[A-Za-z0-9_-]+)"/)||html.match(/<meta itemprop="channelId" content="(UC[A-Za-z0-9_-]+)"/);
  if(!found)throw new Error(`Could not identify ${raw}`);
  return found[1];
}

function initialData(html){
  const markers=['var ytInitialData = ','window["ytInitialData"] = ','ytInitialData = '];
  let start=-1;
  for(const marker of markers){const at=html.indexOf(marker);if(at>=0){start=html.indexOf('{',at+marker.length);break}}
  if(start<0)return null;
  let depth=0,inString=false,escaped=false;
  for(let i=start;i<html.length;i++){
    const c=html[i];
    if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue}
    if(c==='"'){inString=true;continue}if(c==='{')depth++;if(c==='}'&&--depth===0){try{return JSON.parse(html.slice(start,i+1))}catch{return null}}
  }
  return null;
}

function channelSearchResults(data){
  const found=[],seen=new Set();
  function walk(value){
    if(!value||typeof value!=='object')return;
    if(value.channelRenderer){
      const c=value.channelRenderer,id=c.channelId;
      if(id&&!seen.has(id)){
        seen.add(id);
        const title=c.title?.simpleText||c.title?.runs?.map(r=>r.text).join('')||'YouTube Channel';
        const thumb=c.thumbnail?.thumbnails?.at(-1)?.url||'';
        const path=c.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url||`/channel/${id}`;
        found.push({id,title,thumb,url:`${YOUTUBE}${path}`});
      }
    }
    for(const child of Object.values(value))walk(child);
  }
  walk(data);return found.slice(0,8);
}

async function searchChannels(query){
  const url=`${YOUTUBE}/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`;
  const html=await getText(url);
  const results=channelSearchResults(initialData(html));
  if(!results.length)throw new Error('No channels found. Try the creator’s exact YouTube name.');
  return results;
}

function parseFeed(xml) {
  const channelTitle=decodeXml((xml.match(/<feed[\s\S]*?<title>([\s\S]*?)<\/title>/)||[])[1]||'YouTube Channel');
  const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0,24).map(match=>{
    const body=match[1];
    return {id:(body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)||[])[1],title:decodeXml((body.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||'Untitled')};
  }).filter(v=>v.id);
  return {title:channelTitle,entries};
}

function parseDuration(text='') {
  const match=String(text).trim().match(/^(\d+)(?::(\d{2}))(?::(\d{2}))?$/);
  if(!match)return 0;
  return match[3]?Number(match[1])*3600+Number(match[2])*60+Number(match[3]):Number(match[1])*60+Number(match[2]);
}

function parseVideosPage(html) {
  const data=initialData(html);
  const entries=[],seen=new Set();
  function walk(value) {
    if(!value||typeof value!=='object')return;
    const video=value.videoRenderer||value.gridVideoRenderer;
    const lockup=value.lockupViewModel;
    const id=video?.videoId||(lockup?.contentType==='LOCKUP_CONTENT_TYPE_VIDEO'?lockup.contentId:'');
    if(id&&!seen.has(id)) {
      seen.add(id);
      const title=video?.title?.simpleText||video?.title?.runs?.map(run=>run.text).join('')||lockup?.metadata?.lockupMetadataViewModel?.title?.content||'Untitled';
      const details=JSON.stringify(video||lockup);
      const durationText=video?.lengthText?.simpleText||(details.match(/"(?:simpleText|text|content)":"(\d{1,3}(?::\d{2}){1,2})"/)||[])[1]||'';
      entries.push({id,title,duration:parseDuration(durationText)});
    }
    for(const child of Object.values(value))walk(child);
  }
  walk(data);
  const title=data?.metadata?.channelMetadataRenderer?.title||'YouTube Channel';
  return {title,entries:entries.slice(0,24)};
}

function parseShortIds(html) {
  const data=initialData(html),ids=new Set();
  function walk(value) {
    if(!value||typeof value!=='object')return;
    const id=value.reelItemRenderer?.videoId
      ||value.shortsLockupViewModel?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId
      ||value.shortsLockupViewModel?.contentId;
    if(id)ids.add(id);
    for(const child of Object.values(value))walk(child);
  }
  walk(data);
  return ids;
}

async function getChannelFeed(channelId) {
  try {
    const html=await getText(`${YOUTUBE}/channel/${encodeURIComponent(channelId)}/videos`);
    const page=parseVideosPage(html);
    if(page.entries.length)return page;
  } catch {}
  const [feedResult,shortsResult]=await Promise.allSettled([
    getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`),
    getText(`${YOUTUBE}/channel/${encodeURIComponent(channelId)}/shorts`)
  ]);
  const feed=feedResult.status==='fulfilled'?parseFeed(feedResult.value):null;
  const shortIds=shortsResult.status==='fulfilled'?parseShortIds(shortsResult.value):new Set();
  const entries=(feed?.entries||[]).filter(video=>!shortIds.has(video.id)).slice(0,24);
  if(!entries.length)throw new Error('No recent non-Short videos were found for that channel.');
  return {title:feed?.title||'YouTube Channel',entries};
}

function videoDetails(video) {
  const duration=Number(video.duration)||1800;
  return {...video,duration,estimated:!video.duration};
}

async function mapLimit(items,limit,worker) {
  const results=new Array(items.length);
  let next=0;
  async function run() {
    while(next<items.length) {
      const index=next++;
      try { results[index]=await worker(items[index]); }
      catch { results[index]=null; }
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
  return results;
}

export default async function handler(request,response) {
  response.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=86400');
  if(request.method!=='POST')return response.status(405).json({error:'Use POST'});
  try {
    if(request.body?.action==='search'){
      const query=String(request.body?.query||'').trim().slice(0,100);
      if(!query)return response.status(400).json({error:'Type a channel name first.'});
      return response.status(200).json({results:await searchChannels(query)});
    }
    const inputs=Array.isArray(request.body?.channels)?request.body.channels.map(String).filter(Boolean).slice(0,30):[];
    if(!inputs.length)return response.status(400).json({error:'Paste at least one YouTube channel link.'});
    const channels=(await mapLimit(inputs,4,async input=>{
      const id=await resolveChannel(input);
      const feed=await getChannelFeed(id);
      const shows=feed.entries.map(videoDetails).filter(Boolean);
      return shows.length?{channelId:id,name:feed.title,shows}:null;
    })).filter(Boolean);
    if(!channels.length)throw new Error('No playable recent videos were found.');
    return response.status(200).json({channels});
  } catch(error) {
    return response.status(400).json({error:error?.message||'Could not read those channels.'});
  }
}
