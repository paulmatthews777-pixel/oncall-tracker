const {covered}=require('../autobook/fw.cjs');const assert=require('node:assert');
const seg=(s,e,t='Activity: On-Call - Unavailable Stage',k='Activity')=>({s,e,t,k});
assert.ok(covered([seg('2026-12-02T09:00','2026-12-02T10:00')],'2026-12-02T09:00','2026-12-02T10:00'));
assert.ok(covered([seg('2026-12-02T09:00','2026-12-02T09:30'),seg('2026-12-02T09:30','2026-12-02T10:00')],'2026-12-02T09:00','2026-12-02T10:00'));
assert.ok(!covered([seg('2026-12-02T09:00','2026-12-02T09:30')],'2026-12-02T09:00','2026-12-02T10:00'));
assert.ok(!covered([seg('2026-12-02T09:00','2026-12-02T10:00','Activity: On-Call - Turn Out','Activity')],'2026-12-02T09:00','2026-12-02T10:00'));
assert.ok(!covered([],'2026-12-02T09:00','2026-12-02T10:00'));
console.log('covered tests passed');
