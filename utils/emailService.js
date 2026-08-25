const nodemailer = require('nodemailer');

// Get configuration from environment variables or defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'nikn63641@gmail.com';

let transporter = null;

// Initialize transporter
const getTransporter = async () => {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpPort = process.env.SMTP_PORT || process.env.EMAIL_PORT;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.gmail.com',
      port: Number(smtpPort) || 587,
      secure: Number(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  } else {
    // Fallback: Create ethereal test transport for dev mode without valid credentials
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('📧 EmailService initialized with Ethereal dev credentials:', testAccount.user);
    } catch (err) {
      console.warn('⚠️ Could not create Ethereal test transport, logging emails to console only.');
      transporter = null;
    }
  }

  return transporter;
};

/**
 * Send Email Notification to Admin when a User registers as a Seller
 */
const sendSellerRegistrationEmailToAdmin = async ({ sellerName, sellerEmail, sellerId }) => {
  const adminRecipient = ADMIN_EMAIL;
  const subject = `🔔 New Seller Registration: ${sellerName}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #c5a059;">Nitin Real Estate - Admin Alert</h2>
      <p>Hello Admin,</p>
      <p>A new user has registered as a <strong>Seller</strong> on your platform and requires verification before listing properties.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Seller Name:</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${sellerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Seller Email:</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><a href="mailto:${sellerEmail}">${sellerEmail}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">User ID:</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${sellerId}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Status:</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #d97706; font-weight: bold;">Pending Verification</td>
        </tr>
      </table>
      <p>Please log into your <strong>Admin Dashboard</strong> to verify and approve this seller's account.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;" />
      <small style="color: #888;">This is an automated notification from Nitin Real Estate System.</small>
    </div>
  `;

  console.log(`\n==================================================`);
  console.log(`📧 [EMAIL SENT TO ADMIN]`);
  console.log(`To: ${adminRecipient}`);
  console.log(`Subject: ${subject}`);
  console.log(`Seller Details: ${sellerName} (${sellerEmail}) - ID: ${sellerId}`);
  console.log(`==================================================\n`);

  try {
    const activeTransporter = await getTransporter();
    if (activeTransporter) {
      const info = await activeTransporter.sendMail({
        from: '"Nitin Real Estate System" <noreply@nitinrealestate.com>',
        to: adminRecipient,
        subject: subject,
        html: htmlContent,
      });
      if (nodemailer.getTestMessageUrl(info)) {
        console.log(`🔗 Preview Admin Email URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    }
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to dispatch email to admin:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send Email Notification to Seller when Admin verifies their account
 */
const sendSellerVerifiedEmailToUser = async ({ sellerName, sellerEmail }) => {
  const subject = `🎉 Congratulations! Your Seller Account is Verified - Nitin Real Estate`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">Account Verification Successful!</h2>
      <p>Dear ${sellerName},</p>
      <p>Great news! Your <strong>Seller Account</strong> on Nitin Real Estate has been reviewed and verified by our Administrator.</p>
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
        <h4 style="margin: 0 0 5px 0; color: #15803d;">You can now list your properties!</h4>
        <p style="margin: 0; color: #166534; font-size: 14px;">Log in to your account and navigate to the <strong>Sell Property</strong> page to publish your property listings to potential buyers.</p>
      </div>
      <p>Thank you for partnering with Nitin Real Estate.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;" />
      <small style="color: #888;">Nitin Real Estate Platform</small>
    </div>
  `;

  console.log(`\n==================================================`);
  console.log(`📧 [EMAIL SENT TO SELLER]`);
  console.log(`To: ${sellerEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`==================================================\n`);

  try {
    const activeTransporter = await getTransporter();
    if (activeTransporter) {
      const info = await activeTransporter.sendMail({
        from: '"Nitin Real Estate System" <noreply@nitinrealestate.com>',
        to: sellerEmail,
        subject: subject,
        html: htmlContent,
      });
      if (nodemailer.getTestMessageUrl(info)) {
        console.log(`🔗 Preview Seller Email URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    }
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to dispatch verification email to seller:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendSellerRegistrationEmailToAdmin,
  sendSellerVerifiedEmailToUser
};
