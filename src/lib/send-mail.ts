import FormData from 'form-data';
import Mailgun from 'mailgun.js';

interface ResponseMssg {
  message: string,
  error_code: number
}

const getToken = async () => {
  try{
  const api = "https://api.sendpulse.com/oauth/access_token"
  const params = {
    grant_type: "client_credentials",
    client_id: process.env.SENDPULSE_ID,
    client_secret: process.env.SENDPULSE_SECRET
 }
  const resp = await fetch(api, {
    method: "POST",
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify(params)
  })
  if(resp.status != 200) {
    const {statusText, body} = resp
    console.log(statusText, body)
    throw new Error(statusText)
  }
  return resp.json()
  } catch(err) {
    return {
      success: false,
      error: err
    }
  }
}

const sendMail = async (mail:any) => {
  const api = 'https://api.sendpulse.com/smtp/emails';
  const {access_token} = await getToken();
  const email = 'hotline@therichard.space'
  try {
    const data = mail

    const resp = await fetch(api, {
      method: "POST",
      headers: {
        'Content-type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify(data)
    });
    


    if(await resp.status != 200) {
      console.log('SERVER RESPONSE:')
      const {message, error_code}:ResponseMssg = await resp.json()
      console.log(await resp.json())
      return {
        success: false,
        message: `${message} (error ${error_code}`
      }
    }

    return {
      success: true,
      message: await resp.json()
    }
  } catch (err:unknown) {
      console.log(err)
      return {
        success: false,
        message: err
      }
  }
}

export default sendMail



