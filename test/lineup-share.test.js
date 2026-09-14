import test from'node:test';import assert from'node:assert/strict';import{decodeLineup,encodeLineup}from'../lineup-share.js';const a='UC1234567890123456789012';test('share round trip',()=>assert.deepEqual(decodeLineup('#lineup='+encodeLineup([[a,'Oddities',[]]] )).channels,[[a,'Oddities',[]]]));test('bad payload',()=>assert.ok(decodeLineup('#lineup=bad').error));
test('playlist stations survive sharing alongside creator channels',()=>{
 const entries=[['playlist:PLVKuQ0TpzAbfIbgfIAQOQs9Y7e6dRjknw','Playlist'],['UC1234567890123456789012','Creator']];
 const decoded=decodeLineup('#lineup='+encodeLineup(entries));
 assert.deepEqual(decoded.channels.map(entry=>entry.slice(0,2)),entries);
});
