/*
  # Email Notification Edge Function

  1. Purpose
    - Sends email notifications when invoices are paid
    - Uses Resend API for reliable email delivery

  2. Email Types
    - Payment confirmation to invoice creator
    - Payment receipt to payer

  3. Environment Variables Required
    - RESEND_API_KEY: Your Resend API key

  4. Security
    - Validates request data
    - Handles errors gracefully
    - CORS enabled for frontend requests
*/

interface EmailRequest {
  type: 'payment_confirmation' | 'payment_receipt';
  invoice: {
    id: string;
    amount: number;
    description: string;
    creator_wallet_address: string;
    recipient_address: string;
    payment_hash: string;
    created_at: string;
  };
  creator_email: string;
  payer_email?: string;
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

    // Handle GET requests for testing/health checks
    if (req.method === "GET") {
      return new Response(
        JSON.stringify({ 
          status: "ok", 
          message: "Email notification endpoint is running",
          methods: ["GET", "POST"],
          note: "POST requests are used to send email notifications"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only GET and POST methods allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY environment variable not set");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Parse request data
    const emailRequest: EmailRequest = await req.json();

    // Validate required fields
    if (!emailRequest.type || !emailRequest.invoice || !emailRequest.creator_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const { invoice, creator_email, payer_email, type } = emailRequest;

    // Prepare email content based on type
    let emailData;
    
    if (type === 'payment_confirmation') {
      // Email to invoice creator
      emailData = {
        from: "Crypto Invoice <noreply@yourdomain.com>", // Replace with your verified domain
        to: [creator_email],
        subject: `Payment Received - Invoice ${invoice.id.slice(0, 8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Payment Received! 🎉</h1>
            </div>
            
            <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
              <h2 style="color: #1e293b; margin-top: 0;">Invoice Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Invoice ID:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-family: monospace;">${invoice.id.slice(0, 8)}...</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: bold; font-size: 18px;">${invoice.amount} USDC</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Description:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${invoice.description}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Paid By:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-family: monospace; font-size: 12px;">${invoice.recipient_address}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Transaction:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-family: monospace; font-size: 12px;">${invoice.payment_hash}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #dcfce7; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
              <p style="margin: 0; color: #166534; font-weight: 500;">
                ✅ The payment has been successfully processed and confirmed on the blockchain.
              </p>
            </div>
            
            <div style="text-align: center; color: #64748b; font-size: 14px;">
              <p>Thank you for using Crypto Invoice Platform!</p>
              <p style="margin: 0;">Powered by Coinbase Smart Wallet</p>
            </div>
          </div>
        `,
      };
    } else if (type === 'payment_receipt' && payer_email) {
      // Email to payer
      emailData = {
        from: "Crypto Invoice <noreply@yourdomain.com>", // Replace with your verified domain
        to: [payer_email],
        subject: `Payment Confirmation - ${invoice.amount} USDC`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Payment Successful! ✅</h1>
            </div>
            
            <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
              <h2 style="color: #1e293b; margin-top: 0;">Payment Receipt</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount Paid:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: bold; font-size: 18px;">${invoice.amount} USDC</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">For:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${invoice.description}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Paid To:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-family: monospace; font-size: 12px;">${invoice.creator_wallet_address}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Transaction Hash:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-family: monospace; font-size: 12px;">${invoice.payment_hash}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Date:</td>
                  <td style="padding: 8px 0; color: #1e293b;">${new Date().toLocaleDateString()}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #dbeafe; border: 1px solid #93c5fd; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
              <p style="margin: 0; color: #1e40af; font-weight: 500;">
                📧 This serves as your payment confirmation. Keep this email for your records.
              </p>
            </div>
            
            <div style="text-align: center; color: #64748b; font-size: 14px;">
              <p>Thank you for your payment!</p>
              <p style="margin: 0;">Powered by Coinbase Smart Wallet</p>
            </div>
          </div>
        `,
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid email type or missing payer email" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Send email using Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", result);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send email", 
          details: result 
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log("Email sent successfully:", result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        email_id: result.id 
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
    console.error("Error sending email notification:", error);
    return new Response(
      JSON.stringify({
        error: "Server error sending email notification",
        details: error.message,
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