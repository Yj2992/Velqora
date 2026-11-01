export class ApiError extends Error {
  constructor(message:string,public code:string,public status:number){super(message);this.name="ApiError";}
}
export const isQuotaError=(error:unknown)=>error instanceof ApiError && (error.status===429 || error.code==="AI_QUOTA" || error.code==="RATE_LIMITED");
