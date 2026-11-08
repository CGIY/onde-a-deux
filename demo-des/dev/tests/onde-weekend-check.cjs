'use strict';
const assert=require('node:assert/strict'),G=require('../src/onde-app-core.js');
// Expected Paris boundaries were cross-checked independently with zoneinfo.
const cases=[
  {
    "name": "winter_friday_last",
    "at": "2026-11-06T22:59:59.999Z",
    "expectedTickets": 42,
    "expectedCounts": [
      11,
      10,
      10,
      11
    ]
  },
  {
    "name": "winter_saturday_first",
    "at": "2026-11-06T23:00:00Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "winter_sunday_last",
    "at": "2026-11-08T22:59:59.999Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "winter_monday_first",
    "at": "2026-11-08T23:00:00Z",
    "expectedTickets": 42,
    "expectedCounts": [
      11,
      10,
      10,
      11
    ]
  },
  {
    "name": "summer_friday_last",
    "at": "2026-07-10T21:59:59.999Z",
    "expectedTickets": 42,
    "expectedCounts": [
      11,
      10,
      10,
      11
    ]
  },
  {
    "name": "summer_saturday_first",
    "at": "2026-07-10T22:00:00Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "summer_sunday_last",
    "at": "2026-07-12T21:59:59.999Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "summer_monday_first",
    "at": "2026-07-12T22:00:00Z",
    "expectedTickets": 42,
    "expectedCounts": [
      11,
      10,
      10,
      11
    ]
  },
  {
    "name": "spring_dst_before",
    "at": "2026-03-29T00:59:59.999Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "spring_dst_after",
    "at": "2026-03-29T01:00:00Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "spring_sunday_last",
    "at": "2026-03-29T21:59:59.999Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "spring_monday_first",
    "at": "2026-03-29T22:00:00Z",
    "expectedTickets": 42,
    "expectedCounts": [
      11,
      10,
      10,
      11
    ]
  },
  {
    "name": "fall_dst_before",
    "at": "2026-10-25T00:59:59.999Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "fall_dst_after",
    "at": "2026-10-25T01:00:00Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "fall_sunday_last",
    "at": "2026-10-25T22:59:59.999Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "fall_monday_first",
    "at": "2026-10-25T23:00:00Z",
    "expectedTickets": 42,
    "expectedCounts": [
      11,
      10,
      10,
      11
    ]
  },
  {
    "name": "saturday_before_quota",
    "at": "2026-11-07T03:59:59.999Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "saturday_quota",
    "at": "2026-11-07T04:00:00Z",
    "expectedTickets": 155,
    "expectedCounts": [
      22,
      20,
      20,
      93
    ]
  },
  {
    "name": "monday_before_quota",
    "at": "2026-11-09T03:59:59.999Z",
    "expectedTickets": 42,
    "expectedCounts": [
      11,
      10,
      10,
      11
    ]
  },
  {
    "name": "monday_quota",
    "at": "2026-11-09T04:00:00Z",
    "expectedTickets": 42,
    "expectedCounts": [
      11,
      10,
      10,
      11
    ]
  }
];
let checks=0;
for(const test of cases){
 const counts=[0,0,0,0];
 for(let ticket=1;ticket<=test.expectedTickets;ticket++){
  const face=G.rollCategory(2,sides=>{checks++;assert.equal(sides,test.expectedTickets,test.name);return ticket;},test.at);
  checks++;assert.ok(face>=1&&face<=4);counts[face-1]++;
 }
 checks++;assert.deepEqual(counts,test.expectedCounts,test.name);
 if(test.expectedTickets===155){checks++;assert.equal(counts[3]*5,test.expectedTickets*3,'exact 60 percent');checks++;assert.equal(counts[0]*10,counts[1]*11,'other theme ratio');}
}
console.log('Dés·ir exact weekend weighting: '+checks+' exhaustive ticket and Paris midnight/DST/quota-boundary assertions passed.');
