import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeXml,parseDuration,parseFeed,isShortWatchPage,parsePlaylistPage,parseShortIds,parseVideosPage,playlistIdFromInput} from '../api/channels.js';

test('decodeXml handles CDATA, named entities, and numeric entities',()=>{
  assert.equal(decodeXml('<![CDATA[Tom &amp; Jerry &#33;]]>'),'Tom & Jerry !');
});

test('parseDuration accepts minute and hour formats and rejects bad values',()=>{
  assert.equal(parseDuration('4:05'),245);
  assert.equal(parseDuration('1:02:03'),3723);
  assert.equal(parseDuration('live'),0);
});

test('parseFeed extracts videos and decodes titles',()=>{
  const xml=`<feed><title>Odd &amp; Good</title><entry><yt:videoId>abc123</yt:videoId><title>A &lt; B</title></entry><entry><yt:videoId>def456</yt:videoId><title><![CDATA[Second Show]]></title></entry></feed>`;
  assert.deepEqual(parseFeed(xml),{
    title:'Odd & Good',
    entries:[
      {id:'abc123',title:'A < B'},
      {id:'def456',title:'Second Show'}
    ]
  });
});

test('parseVideosPage extracts renderer titles and durations',()=>{
  const data={
    metadata:{channelMetadataRenderer:{title:'Fixture Channel'}},
    contents:[{videoRenderer:{
      videoId:'video1',
      title:{runs:[{text:'Fixture Program'}]},
      lengthText:{simpleText:'12:34'}
    }}]
  };
  const parsed=parseVideosPage(`var ytInitialData = ${JSON.stringify(data)};`);
  assert.equal(parsed.title,'Fixture Channel');
  assert.deepEqual(parsed.entries,[{id:'video1',title:'Fixture Program',duration:754}]);
});

test('channel and playlist parsers retain up to 100 videos',()=>{
  const contents=Array.from({length:120},(_,index)=>({videoRenderer:{videoId:`video${index}`,title:{simpleText:`Program ${index}`},lengthText:{simpleText:'3:00'}}}));
  const html=`var ytInitialData = ${JSON.stringify({contents})};`;
  assert.equal(parseVideosPage(html).entries.length,100);
  const playlistContents=Array.from({length:120},(_,index)=>({playlistVideoRenderer:{videoId:`playlist${index}`,title:{simpleText:`Playlist Program ${index}`},lengthText:{simpleText:'3:00'}}}));
  assert.equal(parsePlaylistPage(`var ytInitialData = ${JSON.stringify({contents:playlistContents})};`).entries.length,100);
});

test('video and playlist parsers filter members-only uploads',()=>{
  const memberBadge={metadataBadgeRenderer:{style:'BADGE_STYLE_TYPE_MEMBERS_ONLY',label:'Members only'}};
  const channelData={
    metadata:{channelMetadataRenderer:{title:'Fixture Channel'}},
    contents:[
      {videoRenderer:{videoId:'public1',title:{simpleText:'Public Program'},lengthText:{simpleText:'4:05'}}},
      {videoRenderer:{videoId:'member1',title:{simpleText:'Member Program'},lengthText:{simpleText:'5:00'},badges:[memberBadge]}}
    ]
  };
  assert.deepEqual(parseVideosPage(`var ytInitialData = ${JSON.stringify(channelData)};`).entries,[
    {id:'public1',title:'Public Program',duration:245}
  ]);

  const playlistData={contents:[
    {playlistVideoRenderer:{videoId:'public2',title:{simpleText:'Public Playlist Video'},lengthText:{simpleText:'3:00'}}},
    {playlistVideoRenderer:{videoId:'member2',title:{simpleText:'Member Playlist Video'},lengthText:{simpleText:'6:00'},badges:[memberBadge]}}
  ]};
  assert.deepEqual(parsePlaylistPage(`var ytInitialData = ${JSON.stringify(playlistData)};`).entries,[
    {id:'public2',title:'Public Playlist Video',source:'YouTube',duration:180}
  ]);
});

test('parseShortIds recognizes reel and lockup models',()=>{
  const data={items:[
    {reelItemRenderer:{videoId:'short1'}},
    {shortsLockupViewModel:{contentId:'short2'}}
  ]};
  assert.deepEqual([...parseShortIds(`var ytInitialData = ${JSON.stringify(data)};`)].sort(),['short1','short2']);
});

test('playlistIdFromInput accepts shared links and stored playlist IDs',()=>{
  assert.equal(playlistIdFromInput('https://youtube.com/playlist?list=PLRmpOEZ5F1SA&si=share'),'PLRmpOEZ5F1SA');
  assert.equal(playlistIdFromInput('playlist:PLRmpOEZ5F1SA'),'PLRmpOEZ5F1SA');
  assert.equal(playlistIdFromInput('https://example.com/?list=PLRmpOEZ5F1SA'),'');
});

test('parsePlaylistPage extracts modern playlist lockups with creators and durations',()=>{
  const lockup={
    contentId:'video1',contentType:'LOCKUP_CONTENT_TYPE_VIDEO',
    metadata:{lockupMetadataViewModel:{title:{content:'Strange Cartoon'},metadata:{contentMetadataViewModel:{metadataRows:[{metadataParts:[{text:{content:'Odd Animator'}}]}]}}}},
    contentImage:{thumbnailViewModel:{overlays:[{thumbnailBottomOverlayViewModel:{badges:[{thumbnailBadgeViewModel:{text:'4:05'}}]}}]}}
  };
  const data={
    sidebar:{playlistSidebarRenderer:{items:[{playlistSidebarPrimaryInfoRenderer:{title:{runs:[{text:'Weird Animation'}]}}}]}},
    contents:[{lockupViewModel:lockup}]
  };
  assert.deepEqual(parsePlaylistPage(`var ytInitialData = ${JSON.stringify(data)};`),{
    title:'Weird Animation',entries:[{id:'video1',title:'Strange Cartoon',source:'Odd Animator',duration:245}]
  });
});


test('watch-page canonical metadata identifies Shorts outside the Shorts-tab batch',()=>{
  assert.equal(isShortWatchPage('<link rel="canonical" href="https://www.youtube.com/shorts/_fD4zpN-J9s">'),true);
  assert.equal(isShortWatchPage('{"canonicalUrl":"https://www.youtube.com/shorts/qSokE8vy6NM"}'),true);
  assert.equal(isShortWatchPage('<link rel="canonical" href="https://www.youtube.com/watch?v=regular">'),false);
});
