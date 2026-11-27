const test=require('node:test'),assert=require('node:assert/strict');
const calendar=require('../autobook/calendar-readback.cjs');
const cdp=require('../autobook/cdp.cjs'),fw=require('../autobook/fw.cjs');
const item=(s,e,tooltip='Activity: On-Call - Unavailable Stage')=>({id:s,itemDateTimeStart:s,itemDateTimeEnd:e,type:'Activity',tooltip});
const response=items=>[{updateTargetId:'employeeCalendarGridContainer',html:'{"Records":'+JSON.stringify([{'18:00':JSON.stringify({plannerItem:items})}])+'}'}];
test('read-back requests every intersecting calendar week, not seven days from start',()=>{
  assert.deepEqual(calendar.weeksFor({from:'2026-12-06T18:00',to:'2026-12-07T06:00'}),['2026-11-30','2026-12-07']);
  assert.deepEqual(calendar.weeksFor({from:'2026-12-03T18:00',to:'2026-12-04T06:00'}),['2026-11-30']);
  assert.deepEqual(calendar.weeksFor({from:'2026-12-06T18:00',to:'2026-12-07T00:00'}),['2026-11-30']);
});
test('direct read-back parses fresh response and joins midnight-adjacent Activity segments',async()=>{
  const real=cdp.evalJs,requested=[];
  cdp.evalJs=async(c,js)=>{
    assert.match(js,/Calendar\/GetEmployeeCalendar/);assert.doesNotMatch(js,/SaveAndClose|pinButtonOK|SelectedDate.*trigger/);
    const first=js.includes('2026-11-30T00:00:00.000Z');requested.push(first?'2026-11-30':'2026-12-07');
    return JSON.stringify(response([first?item('2026-12-06T18:00','2026-12-07T00:00'):item('2026-12-07T00:00','2026-12-07T06:00')]));
  };
  try{assert.equal(await fw.readback({}, {from:'2026-12-06T18:00',to:'2026-12-07T06:00'}),true);assert.deepEqual(requested,['2026-11-30','2026-12-07'])}
  finally{cdp.evalJs=real}
});
test('missing grid and malformed Records throw instead of pretending a booking is absent',()=>{
  assert.throws(()=>calendar.parseWeek([]));assert.throws(()=>calendar.records('{"Records":[oops'));
  assert.equal(fw.covered(calendar.parseWeek(response([item('2026-12-03T18:00','2026-12-04T06:00','Activity: On-Call - Available')])),'2026-12-03T18:00','2026-12-04T06:00'),false);
});
test('timezone-aware summer timestamps are compared in UK wall time',()=>{
  assert.equal(calendar.wall('2026-07-01T17:00:00Z'),'2026-07-01T18:00');
  assert.equal(calendar.wall('2026-12-03T18:00'),'2026-12-03T18:00');
});
