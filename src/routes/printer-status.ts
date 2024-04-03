const getStatus = (uuid, key) => {
  return true
}

const updateStatus = (uuid, key) => {
  return true
}

export default function handler(req, res) {
  try{
    const {uid, key, status} = req.body;
    if(req.method == "POST") updateStatus(uid, key, status)
    if(req.method == "GET") getStatus(uuid, key)
    console.log(uid, key)
  } catch(err) {
    return res.status(500).json({status: 'failed', error: err.message})
  }
  return res.status(200).json({status: 'success'});
}

