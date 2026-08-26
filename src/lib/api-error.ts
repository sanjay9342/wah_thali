import { NextResponse } from "next/server";
import { ZodError } from "zod";

type ApiRouteHandler<RequestType extends Request = Request, ContextType = unknown> = (
  request: RequestType,
  context: ContextType,
) => Response | Promise<Response>;

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function withApiErrorHandling<RequestType extends Request = Request, ContextType = unknown>(
  handler: ApiRouteHandler<RequestType, ContextType>,
  routeName: string,
): ApiRouteHandler<RequestType, ContextType> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return createApiErrorResponse(error, routeName);
    }
  };
}

export function createApiErrorResponse(error: unknown, routeName = "API route") {
  if (error instanceof Response) {
    return error;
  }

  const requestId = crypto.randomUUID();
  console.error(`${routeName} failed.`, { requestId, error });

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: "Invalid JSON request body.",
        code: "INVALID_JSON",
        requestId,
      },
      { status: 400 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        code: "VALIDATION_ERROR",
        issues: error.flatten(),
        requestId,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: GENERIC_ERROR_MESSAGE,
      code: "INTERNAL_SERVER_ERROR",
      requestId,
      ...(process.env.NODE_ENV === "production" || !(error instanceof Error) ? {} : { details: error.message }),
    },
    { status: 500 },
  );
}
