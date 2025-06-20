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
        JSON.stringify({ errors }),
        {
          status: 400,
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
          chainId: requestData.chainId,
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