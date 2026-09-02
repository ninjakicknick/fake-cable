const YOUTUBE = 'https://www.youtube.com';
const HEADERS = {'user-agent':'Mozilla/5.0 (compatible; ElsewhereCable/1.0)','accept-language':'en-US,en;q=0.9'};

function decodeXml(value='') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}

async function getText(url, timeout=7000) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeout);
  try {
    const result = await fetch(url,{headers:HEADERS,redirect:'follow',signal:controller.signal});
    if(!result.ok) throw new Error(`YouTube returned ${result.status}`);
    return await result.text();
  } finally { clearTimeout(timer); }
}

async function resolveChannel(input) {
  const raw=String(input||'').trim();
  const direct=raw.match(/(?:channel\/)?(UC[A-Za-z0-9_-]{20,})/);
  if(direct) return direct[1];
  let path=raw;
  try { const u=new URL(raw.includes('://')?raw:`https://youtube.com/${raw.replace(/^\//,'')}`); if(!/(^|\.)youtube\.com$/.test(u.hostname))throw 0; path=u.pathname; } catch { throw new Error(`Not a YouTube channel: ${raw}`); }
  if(!/^\/(?:@|c\/|user\/)/.test(path))throw new Error(`Use a channel or @handle link: ${raw}`);
  const html=await getText(`${YOUTUBE}${path}`);
  const found=html.match(/"channelId":"(UC[A-Za-z0-9_-]+)"/)||html.match(/<meta itemprop="channelId" content="(UC[A-Za-z0-9_-]+)"/);
  if(!found)throw new Error(`Could not identify ${raw}`);
  return found[1];
}

function parseFeed(xml) {
  const channelTitle=decodeXml((xml.match(/<feed[\s\S]*?<title>([\s\S]*?)<\/title>/)||[])[1]||'YouTube Channel');
  const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0,8).map(match=>{
    const body=match[1];
    return {id:(body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)||[])[1],title:decodeXml((body.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||'Untitled')};
  }).filter(v=>v.id);
  return {title:channelTitle,entries};
}

async function videoDetails(video) {
  try {
    const html=await getText(`${YOUTUBE}/watch?v=${encodeURIComponent(video.id)}`,5500);
    if(/"playableInEmbed":false/.test(html))return null;
    const seconds=Number((html.match(/"lengthSeconds":"(\d+)"/)||[])[1]||0);
    const millis=Number((html.match(/"approxDurationMs":"(\d+)"/)||[])[1]||0);
    return {...video,duration:seconds||Math.round(millis/1000)||1800,estimated:!(seconds||millis)};
  } catch { return {...video,duration:1800,estimated:true}; }
}

export default async function handler(request,response) {
  response.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=86400');
  if(request.method!=='POST')return response.status(405).json({error:'Use POST'});
  try {
    const inputs=Array.isArray(request.body?.channels)?request.body.channels.map(String).filter(Boolean).slice(0,12):[];
    if(!inputs.length)return response.status(400).json({error:'Paste at least one YouTube channel link.'});
    const channels=[];
    for(const input of inputs) {
      const id=await resolveChannel(input);
      const xml=await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`);
      const feed=parseFeed(xml);
      const shows=(await Promise.all(feed.entries.map(videoDetails))).filter(Boolean);
      if(shows.length)channels.push({channelId:id,name:feed.title,shows});
    }
    if(!channels.length)throw new Error('No playable recent videos were found.');
    return response.status(200).json({channels});
  } catch(error) {
    return response.status(400).json({error:error?.message||'Could not read those channels.'});
  }
}
