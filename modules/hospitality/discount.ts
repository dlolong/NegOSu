// Integer minor-unit preview; authoritative room rates and final prices are
// still validated by the existing cashier RPC before recording payment.
export function discountedRoomPrice(base:number,percentage:string):number|null {
 if(!Number.isSafeInteger(base)||base<0||!/^\d{1,3}(\.\d{1,2})?$/.test(percentage))return null;
 const [whole,fraction=""]=percentage.split(".");
 const basisPoints=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(basisPoints>10000)return null;
 return Number((BigInt(base)*BigInt(10000-basisPoints)+5000n)/10000n);
}
