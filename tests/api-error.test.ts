import {it,expect} from "vitest";
import {ApiError,isQuotaError} from "../lib/client/api-error";
it("recognizes structured quota errors without matching arbitrary error text",()=>{
 expect(isQuotaError(new ApiError("Quota reached","AI_QUOTA",429))).toBe(true);
 expect(isQuotaError(new ApiError("Wait","RATE_LIMITED",429))).toBe(true);
 expect(isQuotaError(new ApiError("Other rate limit","OTHER",429))).toBe(true);
 expect(isQuotaError(new ApiError("Not signed in","AUTH",401))).toBe(false);
 expect(isQuotaError(new Error("Quota reached"))).toBe(false);
 expect(new ApiError("Failed","X",500)).toBeInstanceOf(Error);
});
