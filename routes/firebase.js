var firebase = require('firebase')

var config = {
  "apiKey": process.env.GOOGLE_API_KEY,
  "authDomain": "gattendance-cc4ca.firebaseapp.com",
  "databaseURL": "https://gattendance-cc4ca.firebaseio.com",
  "projectId": "gattendance-cc4ca",
  "storageBucket": "gattendance-cc4ca.appspot.com"
}
firebase.initializeApp(config)

var db = firebase.database()

module.exports = db
