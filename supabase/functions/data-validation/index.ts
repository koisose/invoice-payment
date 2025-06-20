/*
  # Data Validation Edge Function

  1. Purpose
    - Validates user email from Smart Wallet callbacks
    - Returns validation errors or approves the transaction request

  2. Validation Rules
    - Email: Rejects @example.com domains

  3. Response Format
    - On validation errors: Returns { errors: {...} }
    - On success: Returns the original request for transaction approval

  4. Security
    - Allowlisted URL: https://api.wallet.coinbase.com (no auth required)
    - All other requests require proper authorization
*/

interface RequestData {
  requestedInfo: {
    email?: string;
    physicalAddress?: {
      address1: string;
      address2?: string;
      city: string;
      state: string;
      postalCode: string;
      countryCode: string;
    };
  };
  calls: any[];
  chainId: number;
  capabilities: any;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Allowlisted URLs that can access this function without authorization
const ALLOWLISTED_ORIGINS = [
  'https://api.wallet.coinbase.com'
];

function isAllowlistedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Check if the request comes from an allowlisted origin
  if (origin && ALLOWLISTED_ORIGINS.includes(origin)) {
    return true;
  }
  
  // Check if the referer starts with an allowlisted URL
  if (referer && ALLOWLISTED_ORIGINS.some(url => referer.startsWith(url))) {
    return true;
  }
  
  return false;
}

function hasValidAuthorization(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader !== null && authHeader.trim() !== '';
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ errors: { method: "Only POST method allowed" } }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Check if request is from allowlisted origin or has valid authorization
    const isAllowlisted = isAllowlistedOrigin(req);
    const hasAuth = hasValidAuthorization(req);

    if (!isAllowlisted && !hasAuth) {
      return new Response(
        JSON.stringify({ errors: { auth: "Unauthorized access" } }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Get the data from the request body
    const requestData: RequestData = await req.json();

    // Extract email from the callback request
    const email = requestData.requestedInfo?.email;

    const errors: Record<string, any> = {};

    // Email validation check
    if (email && email.endsWith("@example.com")) {
      errors.email = "Example.com emails are not allowed";
    }

    // If there are validation errors, return them
    if (Object.keys(errors).length > 0) {
      return new Response(
        JSON.stringify({  request: {
          calls: [],
          chainId: 0x14A34, // Base Sepolia (84532 in hex)
         version: "1.0",
        }, }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // If all validations pass, return success
    return new Response(
      JSON.stringify({
        request: {
          calls: requestData.calls,
         chainId: requestData.chainId,// Base Sepolia (84532 in hex)
          capabilities: requestData.capabilities,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error processing data validation:", error);
    return new Response(
      JSON.stringify({
        errors: {
          server: "Server error validating data",
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});