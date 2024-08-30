import app, {userExists} from "../lib/firebase-server"
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');

export interface userObj {
  firstName: string,
  lastname: string,
  username: string
  email: string,
}

export const addUser = async (userData: userObj) => {
  try {
    const {firstName, lastname, username, email} = userData;
    const db = getFirestore(app);
    if(await userExists(username) && username) {
      const resp = await db.collection('users').doc(username).update({
        ...userData,
        last_connection: 'never',
        printer_status: 'offline'
      })
      console.log(resp)
      return true
    } else {
      throw EvalError('User already exists!')
    }
  } catch (err) {
    throw err
  }
}