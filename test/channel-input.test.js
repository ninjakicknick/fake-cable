import test from 'node:test';
import assert from 'node:assert/strict';
import {isDirectYouTubeInput,stationLabelAfterFetch,channelFromApi} from '../channel-input.js';

test('direct YouTube inputs bypass creator-name search',()=>{
  assert.equal(isDirectYouTubeInput('https://youtube.com/@bobross_thejoyofpainting'),true);
  assert.equal(isDirectYouTubeInput('https://www.youtube.com/playlist?list=PL123'),true);
  assert.equal(isDirectYouTubeInput('https://youtu.be/abc123'),true);
  assert.equal(isDirectYouTubeInput('@bobross_thejoyofpainting'),true);
});

test('creator names still use search',()=>{
  assert.equal(isDirectYouTubeInput('Bob Ross'),false);
  assert.equal(isDirectYouTubeInput('Technology Connections'),false);
});

test('stationLabelAfterFetch replaces a temporary pasted URL with the fetched title',()=>{
  const value='https://youtube.com/playlist?list=PL123';
  assert.equal(stationLabelAfterFetch({value,label:value},'Midnight Movies'),'Midnight Movies');
});

test('stationLabelAfterFetch preserves an intentional custom label',()=>{
  assert.equal(stationLabelAfterFetch({value:'playlist:PL123',label:'My Movies'},'Midnight Movies'),'My Movies');
});

test('refreshing a channel preserves its custom name, duration confidence, and skips known unavailable videos',()=>{
  const api={name:'Source Name',channelId:'UC123',shows:[
    {title:'Broken',id:'bad',duration:60},
    {title:'Working',source:'Other Creator',id:'good',duration:1800,estimated:true}
  ]};
  const existing={channelId:'UC123',customName:'My Station',color:'#123456',unavailableIds:['bad']};
  const channel=channelFromApi(api,2,existing);
  assert.equal(channel.n,4);
  assert.equal(channel.name,'MY STATION');
  assert.equal(channel.sourceName,'SOURCE NAME');
  assert.equal(channel.color,'#123456');
  assert.deepEqual(channel.shows,[['Working','Other Creator','good',1800,null,true]]);
  assert.deepEqual(channel.unavailableIds,['bad']);
});

test('replacing a station never inherits a different station name or blacklist',()=>{
 const channel=channelFromApi({channelId:'new',name:'New',shows:[{id:'video',title:'Video',duration:60}]},0,{channelId:'old',customName:'Old Name',unavailableIds:['video']});
 assert.equal(channel.name,'NEW');assert.equal(channel.shows.length,1);assert.deepEqual(channel.unavailableIds,[]);
});
