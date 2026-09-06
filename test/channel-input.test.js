import test from 'node:test';
import assert from 'node:assert/strict';
import {isDirectYouTubeInput} from '../channel-input.js';

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
