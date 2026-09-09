import test from 'node:test';
import assert from 'node:assert/strict';
import {isDirectYouTubeInput,stationLabelAfterFetch} from '../channel-input.js';

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
