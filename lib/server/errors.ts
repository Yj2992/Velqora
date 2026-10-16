import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function fail(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Please check the information you entered.",
        },
      },
      { status: 400 },
    );
  return NextResponse.json(
    {
      error: {
        code: "REQUEST_FAILED",
        message: "We could not complete this request. Please try again.",
      },
    },
    { status: 500 },
  );
}
export function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error)
    throw new AppError(
      "DATABASE_FAILED",
      "Your data could not be saved or retrieved. Please try again.",
      503,
    );
  return result.data;
}

export function required<T>(result: {
  data: T;
  error: unknown;
}): NonNullable<T> {
  const data = checked(result);
  if (data == null)
    throw new AppError(
      "DATABASE_FAILED",
      "Required data could not be retrieved.",
      503,
    );
  return data;
}
