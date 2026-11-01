import { it, expect, vi, beforeEach } from "vitest";
import { defaultPreferences } from "../lib/products/types";
import { scoreInterpretation } from "../lib/products/rules";
const mock=vi.hoisted(()=>({auth:vi.fn(),quota:vi.fn(),search:vi.fn(),from:vi.fn(),profile:{select:vi.fn(),eq:vi.fn(),single:vi.fn()},scan:{select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn()}}));
vi.mock("../lib/server/auth",()=>({auth:mock.auth,quota:mock.quota,scanSelect:"owned-scan-fields"}));
vi.mock("../lib/ai/web-product-search",()=>({searchWebProducts:mock.search}));
import { POST } from "../app/api/products/discover/route";
const id="21495be6-9f07-4edb-9cde-7cef4438ca70";
const request=(extra={})=>new Request("https://app.test/api/products/discover",{method:"POST",body:JSON.stringify({mode:"scan",scan_id:id,preferences:defaultPreferences,web_consent:true,...extra})});
beforeEach(()=>{vi.clearAllMocks();mock.auth.mockResolvedValue({user:{id:"owner"},db:{from:mock.from}});mock.from.mockImplementation(t=>t==="profiles"?mock.profile:mock.scan);mock.profile.select.mockReturnValue(mock.profile);mock.profile.eq.mockReturnValue(mock.profile);mock.profile.single.mockResolvedValue({data:{llm_consent:true},error:null});mock.scan.select.mockReturnValue(mock.scan);mock.scan.eq.mockReturnValue(mock.scan);mock.scan.maybeSingle.mockResolvedValue({data:{id,status:"completed",provider_version:scoreInterpretation.supportedProvider,skin_age:36,overall_score:78.4,skin_type_results:[{region:"whole",skin_type:"Dry"}],skin_scan_metrics:[]},error:null});mock.quota.mockResolvedValue(undefined);mock.search.mockResolvedValue({source:"groq-web",results:[],searched_at:"2026-11-01",model:"test"});});
it("fetches an owned completed scan and sends only a derived care brief",async()=>{const r=await POST(request());expect(r.status).toBe(200);expect(mock.scan.eq).toHaveBeenCalledWith("id",id);expect(mock.scan.eq).toHaveBeenCalledWith("user_id","owner");expect(mock.scan.eq).toHaveBeenCalledWith("status","completed");const q=mock.search.mock.calls[0][0];expect(q).toContain("dry skin");expect(q).not.toContain(id);expect(q).not.toContain("78.4");expect(q).not.toContain("36");const data=await r.json();expect(data.plan.skin_type).toBe("dry");expect(data).toHaveProperty("needs_review");});
it("rejects a missing or foreign scan before any provider request",async()=>{mock.scan.maybeSingle.mockResolvedValue({data:null,error:null});expect((await POST(request())).status).toBe(404);expect(mock.search).not.toHaveBeenCalled();});
it("does not accept injected scores or age as scan context",async()=>{expect((await POST(request({scores:{moisture:10},skin_age:60}))).status).toBe(400);expect(mock.search).not.toHaveBeenCalled();});
it("does not infer priorities for an unsupported scan provider",async()=>{mock.scan.maybeSingle.mockResolvedValue({data:{status:"completed",provider_version:"other"},error:null});expect((await POST(request())).status).toBe(400);expect(mock.search).not.toHaveBeenCalled();});

it("passes shared concern/category/brand filters to discovery and rejects invalid concerns",async()=>{
 const r=await POST(request({filters:{concerns:["moisture"],brand:"Minimalist",category:"moisturizer",full_ingredients_only:true}}));
 expect(r.status).toBe(200);const q=mock.search.mock.calls[0][0];expect(q).toContain("Brand: Minimalist only");expect(q).toContain("COMPLETE ingredient/INCI");
 mock.search.mockClear();expect((await POST(request({filters:{concerns:["invented"]}}))).status).toBe(400);expect(mock.search).not.toHaveBeenCalled();
});
