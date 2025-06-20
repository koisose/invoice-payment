/*
  # Data Validation Edge Function

  1. Purpose
    - Validates user profile data (email and physical address) from Smart Wallet callbacks
    - Returns validation errors or approves the transaction request

  2. Validation Rules
    - Email: Rejects @example.com domains
    - Physical Address: Validates postal code format, country restrictions, and city restrictions

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

    // Extract data from the callback request
    const email = requestData.requestedInfo?.email;
    const physicalAddress = requestData.requestedInfo?.physicalAddress;

    const errors: Record<string, any> = {};

    // Example validation check for email
    if (email && email.endsWith("@example.com")) {
      errors.email = "Example.com emails are not allowed";
    }

    // Example validation for physical address
    if (physicalAddress) {
      // Initialize physicalAddress errors object if needed
      if (!errors.physicalAddress) {
        errors.physicalAddress = {};
      }

      // Check postal code validation - for example, require specific format
      if (
        physicalAddress.postalCode &&
        (physicalAddress.postalCode.length < 5 ||
          physicalAddress.postalCode.length > 10)
      ) {
        errors.physicalAddress.postalCode = "Invalid postal code format";
      }

      // Check country validation - for example, only allow certain countries
      if (physicalAddress.countryCode && physicalAddress.countryCode === "XY") {
        errors.physicalAddress.countryCode = "We don't ship to this country";
      }

      // Check city validation
      if (
        physicalAddress.city &&
        physicalAddress.city.toLowerCase() === "restricted"
      ) {
        errors.physicalAddress.city = "We don't ship to this city";
      }

      // Remove physicalAddress from errors if no validation errors were added
      if (Object.keys(errors.physicalAddress || {}).length === 0) {
        delete errors.physicalAddress;
      }
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