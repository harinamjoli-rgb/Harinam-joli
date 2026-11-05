import assert from 'node:assert/strict';

assert.equal(Date.parse('2026-09-04T05:15:00+05:30'), Date.parse('2026-09-03T23:45:00Z'));
console.log('Launch time check passed: 4 September 2026, 5:15 AM IST.');
