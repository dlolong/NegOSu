import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discountedRoomPrice} from '../../modules/hospitality/discount';
test('percentage discounts use exact cents and round once',()=>{
 assert.equal(discountedRoomPrice(1200000,'20'),960000);
 assert.equal(discountedRoomPrice(999,'12.50'),874);
 assert.equal(discountedRoomPrice(101,'50'),51);
 assert.equal(discountedRoomPrice(50000,'0'),50000);
 assert.equal(discountedRoomPrice(50000,'100'),0);
});
test('invalid percentages and bases do not produce a payable preview',()=>{
 for(const percentage of ['', '-1','101','1.234','NaN','1e2'])assert.equal(discountedRoomPrice(50000,percentage),null);
 assert.equal(discountedRoomPrice(-1,'20'),null);
 assert.equal(discountedRoomPrice(1.5,'20'),null);
});
