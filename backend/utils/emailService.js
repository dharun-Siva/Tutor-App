const nodemailer = require('nodemailer');

// Create transporter based on environment
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production email configuration (e.g., Gmail, SendGrid, etc.)
    return nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  } else {
    // Development/test configuration - using Ethereal for testing
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    });
  }
};

const sendTutorWelcomeEmail = async (tutor, temporaryPassword) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@tutorplatform.com',
      to: tutor.email,
      subject: 'Welcome to Tutor Platform - Account Created',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .credentials { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6c757d; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Tutor Platform!</h1>
            </div>
            <div class="content">
              <h2>Hello ${tutor.firstName} ${tutor.lastName},</h2>
              
              <p>Congratulations! Your tutor account has been successfully created. We're excited to have you join our educational platform.</p>
              
              <div class="credentials">
                <h3>Your Login Credentials:</h3>
                <p><strong>Email:</strong> ${tutor.email}</p>
                <p><strong>Username:</strong> ${tutor.username}</p>
                <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
              </div>
              
              <p><strong>Important Security Notice:</strong> Please change your password after your first login for security purposes.</p>
              
              <h3>What's Next?</h3>
              <ul>
                <li>Log in to your account using the credentials above</li>
                <li>Complete your profile setup</li>
                <li>Review your assigned classes and schedule</li>
                <li>Explore the tutor dashboard and tools</li>
              </ul>
              
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">Login Now</a>
              
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <p>Best regards,<br>The Tutor Platform Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    throw error;
  }
};

const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@tutorplatform.com',
      to: user.email,
      subject: 'Password Reset Request - Tutor Platform',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${user.firstName},</h2>
              
              <p>We received a request to reset your password for your Tutor Platform account.</p>
              
              <p>If you requested this password reset, click the button below to create a new password:</p>
              
              <a href="${resetUrl}" class="button">Reset Password</a>
              
              <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
              
              <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
              
              <p>For security reasons, if you continue to receive these emails, please contact our support team.</p>
              
              <p>Best regards,<br>The Tutor Platform Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
};

module.exports = {
  sendTutorWelcomeEmail,
  sendPasswordResetEmail
};
