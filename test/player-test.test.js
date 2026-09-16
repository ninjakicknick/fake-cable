import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../player-test.html',import.meta.url),'utf8');

test('offset diagnostic page includes the known failing specimen and all three strategies',()=>{
 assert.match(page,/FpXQ0QTpKE0/);
 assert.match(page,/value="1680"/);
 assert.match(page,/loadVideoById\(\{videoId:id,startSeconds:start\}\)/);
 assert.match(page,/cueVideoById\(\{videoId:id,startSeconds:start\}\)/);
 assert.match(page,/seekTo\(start,true\)/);
});
