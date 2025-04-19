import nodemailer from 'nodemailer';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const server = {
  host: process.env.SMTP_HOST || '',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 0,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};



const defaults = {
  from: process.env.MAIL_FROM
}
const transporter = nodemailer.createTransport(server, defaults);

const sendMail = async (options:{to: string, subject: string, html?:string, text?:string}) => {
  const {to, subject, html, text} = options;
  // send mail with defined transport object
  try{
    const from = `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_EMAIL}>`;
    const info = await transporter.sendMail({
      from, // sender address
      to, // list of receivers
      subject, // Subject line
      html,
      text
    });
  
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

export default sendMail;