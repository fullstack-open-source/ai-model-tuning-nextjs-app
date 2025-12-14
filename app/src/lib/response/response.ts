import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { ERRORS as ERROR_MAP } from "./map";

// Utilities
const serializeData = (data: any): any => {
  if (data instanceof Date) return data.toISOString();
  if (typeof data === "bigint") return Number(data);
  if (Array.isArray(data)) return data.map(serializeData);
  if (data && typeof data === "object") {
    // Remove password field - never send password to frontend
    const sanitized = { ...data };
    if ('password' in sanitized) {
      delete sanitized.password;
    }
    return Object.fromEntries(
      Object.entries(sanitized)
        .filter(([k]) => k !== 'password') // Double check - exclude password
        .map(([k, v]) => [k, serializeData(v)])
    );
  }
  return data;
};

// Success Response
export class SUCCESS {
  static build({
    data = null,
    message = "Request successful",
    meta = {},
    requestId,
  }: {
    data?: any;
    message?: string;
    meta?: Record<string, any>;
    requestId?: string;
  }) {
    const serializedData = serializeData(data);

    return {
      success: true,
      id: requestId || uuidv4(),
      message,
      data: serializedData,
      meta: {
        type: Array.isArray(data) ? "array" : typeof data,
        count: Array.isArray(data) ? data.length : undefined,
        ...meta,
      },
      timestamp: new Date().toISOString(),
    };
  }

  static response(
    message: string,
    data: any = {},
    meta: Record<string, any> = {},
    requestId?: string
  ) {
    return SUCCESS.build({ message, data, meta, requestId });
  }

  static json(
    message: string,
    data: any = {},
    meta: Record<string, any> = {},
    statusCode: number = 200,
    requestId?: string
  ) {
    return NextResponse.json(
      SUCCESS.build({ message, data, meta, requestId }),
      { status: statusCode }
    );
  }
}

// Error Response - using comprehensive error map from map.ts
export const ERRORS = ERROR_MAP;

export function getError(errorKey: string) {
  return ERRORS[errorKey] || null;
}

export class ERROR {
  static build({
    errorKey,
    details,
    exception,
  }: {
    errorKey: string;
    details?: any;
    exception?: any;
  }) {
    const error = ERRORS[errorKey] || {
      code: 1015, // Use UNKNOWN_ERROR code instead of 1020
      message: `Dynamic error: ${errorKey}`,
      reason: "Error code not found in error map",
    };

    const errorObj: any = {
      id: uuidv4(),
      code: error.code,
      message: error.message,
      details: serializeData(details),
      timestamp: new Date().toISOString(),
    };

    if (error.reason) {
      errorObj.reason = error.reason;
    }

    if (exception && process.env.DEBUG_MODE === 'true') {
      errorObj.debug = {
        type: exception.constructor?.name,
        message: exception.message,
        stack: exception.stack?.split("\n"),
      };
    }

    return {
      detail: {
        success: false,
        error: errorObj,
      },
      statusCode: (error as any).http_status || 500,
    };
  }

  static fromMap(
    errorKey: string,
    details: any = {},
    exception: any = null
  ) {
    return ERROR.build({ errorKey, details, exception });
  }

  static json(
    errorKey: string,
    details: any = {},
    exception: any = null
  ) {
    const result = ERROR.build({ errorKey, details, exception });
    return NextResponse.json(result.detail, { status: result.statusCode });
  }
}
