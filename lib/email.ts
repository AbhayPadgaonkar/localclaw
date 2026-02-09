import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Google App Password
  },
});

export async function sendInvoiceEmail(
  toEmail: string, 
  userName: string, 
  planName: string, 
  amount: number, 
  transactionId: string
) {
  const date = new Date().toLocaleDateString("en-IN", { 
    year: 'numeric', month: 'long', day: 'numeric' 
  });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 20px; border-radius: 10px; border: 1px solid #333;">
      <h2 style="color: #dc2626; text-transform: uppercase; margin-bottom: 5px;">LocalClaw <span style="color: #f59e0b;">Pro</span></h2>
      <p style="color: #888; font-size: 12px; margin-top: 0;">OFFICIAL RECEIPT</p>
      
      <hr style="border: 0; border-top: 1px solid #333; margin: 20px 0;">
      
      <p>Hello <strong>${userName}</strong>,</p>
      <p>Your arsenal has been upgraded. Deployment limits are removed.</p>
      
      <div style="background-color: #111; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #aaa; font-size: 12px;">PLAN</p>
        <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">${planName}</p>
        
        <p style="margin: 5px 0; color: #aaa; font-size: 12px;">AMOUNT PAID</p>
        <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">₹${amount}</p>
        
        <p style="margin: 5px 0; color: #aaa; font-size: 12px;">TRANSACTION ID</p>
        <p style="margin: 0; font-family: monospace; color: #f59e0b;">${transactionId}</p>
      </div>

      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
        Sent automatically by LocalClaw Systems • ${date}
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"LocalClaw Billing" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Invoice: ${planName} Activated`,
      html: htmlContent,
    });
    console.log("📧 Invoice sent to:", toEmail);
  } catch (error) {
    console.error("❌ Failed to send invoice:", error);
  }
}