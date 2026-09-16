import test from "node:test";
import assert from "node:assert/strict";
import { locationMapLinks, mapEmbedUrl, normalizeMapInput } from "../lib/location-map";
import { branchPublicSchema } from "../lib/public-booking";
const embed="https://www.google.com/maps/embed?pb=!1m18!2m3!3d14.5995!4d120.9842";

test("copied Google map HTML stores a canonical URL and never the markup",()=>{
  const value=normalizeMapInput(`<iframe src="${embed}&amp;unrelated=ignored" width="600" onload="alert(1)"></iframe>`);
  assert.equal(value,mapEmbedUrl(embed));
  assert.doesNotMatch(value!,/iframe|onload|alert|unrelated/);
  assert.equal(normalizeMapInput(embed),value);
  assert.equal(normalizeMapInput(" "),"");
});
test("untrusted frame sources and executable protocols cannot become maps",()=>{
  for(const source of ["javascript:alert(1)","data:text/html,test","//www.google.com/maps/embed?pb=test","https://www.google.com.evil.test/maps/embed?pb=test","https://www.google.com@evil.test/maps/embed?pb=test","https://evil.test/maps/embed?pb=test","http://www.google.com/maps/embed?pb=test","https://www.google.com:444/maps/embed?pb=test","https://www.google.com/maps/embed/v1/place?key=secret","https://www.google.com/maps/embed"]){
    assert.equal(mapEmbedUrl(source),null,source);
    assert.equal(normalizeMapInput(`<iframe src="${source}"></iframe>`),null,source);
  }
  assert.equal(normalizeMapInput(`<iframe src="${embed}"></iframe><script>alert(1)</script>`),null);
  assert.equal(normalizeMapInput("javascript:alert(1)"),null);
  assert.equal(normalizeMapInput("a".repeat(8001)),null);
});
test("existing map links remain external and addresses generate encoded directions",()=>{
  const shared="https://maps.app.goo.gl/example";
  assert.deepEqual(locationMapLinks(shared,"Main",["Manila"]),{embedUrl:null,directionsUrl:shared});
  const mapped=locationMapLinks(embed,"Main & North",["123 Test St",null,"Manila","Philippines"]);
  assert.equal(mapped.embedUrl,mapEmbedUrl(embed));
  const link=new URL(mapped.directionsUrl!);assert.equal(link.origin,"https://www.google.com");assert.equal(link.searchParams.get("api"),"1");assert.equal(link.searchParams.get("destination"),"Main & North, 123 Test St, Manila, Philippines");
  assert.deepEqual(locationMapLinks(null,"Unnamed",[]),{embedUrl:null,directionsUrl:null});
  assert.equal(locationMapLinks("javascript:alert(1)","Unnamed",[]).directionsUrl,null);
});
test("branch settings validate and normalize embed input without relaxing opening hours",()=>{
  const input={branchId:"10000000-0000-4000-8000-000000000001",description:"",mapUrl:`<iframe src="${embed}"></iframe>`,acceptsBookings:true,openingHours:'{"monday":{"open":"08:00","close":"17:00"}}'};
  const result=branchPublicSchema.parse(input);assert.equal(result.mapUrl,mapEmbedUrl(embed));
  assert.equal(branchPublicSchema.safeParse({...input,mapUrl:'<iframe src="https://evil.test"></iframe>'}).success,false);
  assert.equal(branchPublicSchema.safeParse({...input,openingHours:'{"monday":{"open":"17:00","close":"08:00"}}'}).success,false);
});
