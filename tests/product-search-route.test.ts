import { it, expect, vi, beforeEach } from "vitest";
const mock=vi.hoisted(()=>({auth:vi.fn(),quota:vi.fn(),interpret:vi.fn(),catalog:vi.fn(),from:vi.fn(),select:vi.fn(),eq:vi.fn(),single:vi.fn()}));
vi.mock("../lib/server/auth",()=>({auth:mock.auth,quota:mock.quota}));
vi.mock("../lib/ai/product-search",()=>({interpretProductSearch:mock.interpret}));
vi.mock("../lib/products/server",()=>({getCatalog:mock.catalog}));
import { POST } from "../app/api/products/search/route";
import { AppError } from "../lib/server/errors";
const request=(body:unknown={question:"Moisturizer under 500"})=>new Request("https://app.test/api/products/search",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{
 vi.clearAllMocks();const chain={select:mock.select,eq:mock.eq,single:mock.single};mock.from.mockReturnValue(chain);mock.select.mockReturnValue(chain);mock.eq.mockReturnValue(chain);
 mock.single.mockResolvedValue({data:{llm_consent:true},error:null});mock.auth.mockResolvedValue({user:{id:"owner"},db:{from:mock.from}});mock.quota.mockResolvedValue(undefined);mock.catalog.mockResolvedValue([{brand:"Minimalist"}]);mock.interpret.mockResolvedValue({categories:["moisturizer"]});
});
it("requires authenticated access",async()=>{mock.auth.mockRejectedValue(new AppError("UNAUTHENTICATED","Sign in",401));expect((await POST(request())).status).toBe(401);expect(mock.interpret).not.toHaveBeenCalled();});
it("reads only the authenticated owner's consent",async()=>{const r=await POST(request());expect(r.status).toBe(200);expect(mock.from).toHaveBeenCalledWith("profiles");expect(mock.select).toHaveBeenCalledWith("llm_consent");expect(mock.eq).toHaveBeenCalledWith("id","owner");expect(mock.interpret).toHaveBeenCalledWith("Moisturizer under 500",["Minimalist"],true);expect(r.headers.get("Cache-Control")).toContain("no-store");});
it("does not transmit without saved consent",async()=>{mock.single.mockResolvedValue({data:{llm_consent:false},error:null});expect((await POST(request())).status).toBe(403);expect(mock.quota).not.toHaveBeenCalled();expect(mock.interpret).not.toHaveBeenCalled();});
it("enforces rate limits before Groq access",async()=>{mock.quota.mockRejectedValue(new AppError("RATE_LIMITED","Wait",429));expect((await POST(request())).status).toBe(429);expect(mock.interpret).not.toHaveBeenCalled();});
it("does not accept client-supplied consent or scan context",async()=>{expect((await POST(request({question:"A moisturizer",consent:true,scans:[{}]}))).status).toBe(400);expect(mock.interpret).not.toHaveBeenCalled();});
it("rejects overlong input",async()=>{expect((await POST(request({question:"a".repeat(1001)}))).status).toBe(400);expect(mock.interpret).not.toHaveBeenCalled();});
