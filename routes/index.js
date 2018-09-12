var express = require('express')
var router = express.Router()
var axios = require('axios')
var async = require('async')
var GoogleSpreadsheet = require('google-spreadsheet')
var db = require('./firebase.js')

router.post('/seePolicy', function(req, res, next){
  res.send("See page 11 of the student handbook: \n https://assets.ctfassets.net/hu62i9v1xxtm/7ibW4Qib28eiUsCIO2QeQ0/81d42e55b116d8f111791ba46b3a7bd5/CO_DPOS_Galvanize_Catalog_v.2.1.2018__1_.pdf");
})

router.post('/checkTotal', function(req, res, next){
  studentRef = db.ref('/students/' + req.body.user_id)
  studentRef.once('value')
  .then(function(snapshot){
    var studentData = snapshot.val()
    res.send(standardMessage(studentData.total, studentData.unexcused))
  })
})

router.post('/howTo', function(req, res, next){
  res.send(howTo)
})

router.post('/adminHowTo', function(req, res, next){
  res.send(adminHowTo)
})

router.post('/late', function(req, res, next) {
  studentRef = db.ref('/students/' + req.body.user_id)
  studentRef.once('value')
  .then(function(snapshot){
    executeAbsence(snapshot, "partial", 1, 0, standardMessage, res)
  })
})

router.post('/absent', function(req, res, next) {
  studentRef = db.ref('/students/' + req.body.user_id)
  studentRef.once('value')
  .then(function(snapshot){
    executeAbsence(snapshot, "whole day", 3, 0, standardMessage, res)
  })
})

router.post('/correction', function(req, res, next) {
  studentRef = db.ref('/students/' + req.body.user_id)
  studentRef.once('value')
  .then(function(snapshot){
    executeAbsence(snapshot, "corrected to full", 2, 0, standardMessage, res)
  })
})

router.post('/unexcusedFull', function(req, res, next){
  db.ref('/advisors').once('value')
  .then(function(snapshot){
    if (snapshot.val().hasOwnProperty(req.body.user_id)){
      axios.get(slackCredentials + req.body.channel_id)
      .then(data => {
        var studentId = data.data.messages.filter(slackUser => {
          return slackUser.user && slackUser.user !== req.body.user_id && slackUser.user !== "UB7QRMZQT"
        })[0].user
        studentRef = db.ref('/students/' + studentId)
        studentRef.once('value')
        .then(function(snapshot){
          executeAbsence(snapshot, "full day unexcused", 3, 3, unexcusedMessage, res)
        })
      })
    }
    else {
      res.send(instructorOnly)
    }
  })
})

router.post('/unexcusedPartial', function(req, res, next){
  db.ref('/advisors').once('value')
  .then(function(snapshot){
    if (snapshot.val().hasOwnProperty(req.body.user_id)){
      axios.get(slackCredentials + req.body.channel_id)
      .then(data => {
        var studentId = data.data.messages.filter(slackUser => {
          return slackUser.user && slackUser.user !== req.body.user_id && slackUser.user !== "UB7QRMZQT"
        })[0].user
        studentRef = db.ref('/students/' + studentId)
        studentRef.once('value')
        .then(function(snapshot){
          executeAbsence(snapshot, "partial day unexcused", 1, 1, unexcusedMessage, res)
        })
      })
    }
    else {
      res.send(instructorOnly)
    }
  })
})

router.post('/unexcusedCorrection', function(req, res, next){
  db.ref('/advisors').once('value')
  .then(function(snapshot){
    if (snapshot.val().hasOwnProperty(req.body.user_id)){
      axios.get(slackCredentials + req.body.channel_id)
      .then(data => {
        var studentId = data.data.messages.filter(slackUser => {
          return slackUser.user && slackUser.user !== req.body.user_id && slackUser.user !== "UB7QRMZQT"
        })[0].user
        studentRef = db.ref('/students/' + studentId)
        studentRef.once('value')
        .then(function(snapshot){
          executeAbsence(snapshot, "partial to full unexcused", 2, 2, unexcusedMessage, res)
        })
      })
    }
    else {
      res.send(instructorOnly)
    }
  })
})

router.post('/remove', function(req, res, next){
  db.ref('/advisors').once('value')
  .then(function(snapshot){
    if (snapshot.val().hasOwnProperty(req.body.user_id)){
      axios.get(slackCredentials + req.body.channel_id)
      .then(data => {
        var studentId = data.data.messages.filter(slackUser => {
          return slackUser.user && slackUser.user !== req.body.user_id && slackUser.user !== "UB7QRMZQT"
        })[0].user
        studentRef = db.ref('/students/' + studentId)
        studentRef.once('value')
        .then(function(snapshot){
          executeRemove(snapshot, res)
        })
      })
    }
    else {
      res.send(instructorOnly)
    }
  })
})

router.post('/updateStudentList', function(req,res,next){
  var doc = new GoogleSpreadsheet('1xmACQ0Muuzcn83QREp7nFqam5qjxbSde67BldhnP-F8')
  var sheet

  function sortStudents(cells){
    var advisors = {}
    db.ref('/students').once('value')
    .then(function(snapshot){
      return snapshot.val()
    })
    .then(function(studentData){
      for (var i = 1; i < cells.length; i++) {
        if (i % 5 === 1 && !studentData[cells[i].value]) {
          studentData[cells[i].value] = {}
          studentData[cells[i].value].name = cells[i-1].value
          studentData[cells[i].value].total = 0
          studentData[cells[i].value].unexcused = 0
          var placeholder = new Date()
          studentData[cells[i].value].dates = {}
          studentData[cells[i].value].dates[placeholder] = "placeholder"
        }
        if (cells[i].value && cells[i+3].value === "Y" || cells[i].value && cells[i+3].value === "y") {
            advisors[cells[i].value] = cells[i-1].value
        }
      }
      delete studentData['']
      db.ref('/students').set(studentData)
      db.ref('/advisors').set(advisors)
    })
  }

  async.series([
    function setAuth(step) {
      var creds = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY
      }
      console.log(creds)
      doc.useServiceAccountAuth(creds, step)
    },
    function getInfoAndWorksheets(step) {
      doc.getInfo(function(err, info) {
        sheet = info.worksheets[0]
        console.log(sheet);
        step()
      })
    },
    function workingWithCells(step) {
      sheet.getCells({
        'min-row': 3,
        'max-row': 50,
        'min-col': 2,
        'max-col': 6,
        'return-empty': true
      }, function(err, cells) {
        sortStudents(cells)
        res.send("List updated!")
        step()
      })
    }
  ], function(err){
      if( err ) {
        console.log('Error: '+err)
    }
  })
})

var slackCredentials = process.env.SLACK_URL

var instructorOnly = {
  "type": "message",
  "response_type": "in_channel",
  "text": "This command is for instructors only. If you're trying to report an absence, try /partial or /out."
}

var howTo = {
  "type": "message",
  "response_type": "in_channel",
  "text": "Welcome to attendance bot! \nIf you're going to be out, slack your instructor directly using one of the following commands. \n*Students:*\n-Use /attendance-partial to let us know you'll be missing attendance, but you're here today\n-Use /attendance-out to tell us you're gonna be out all day\n-Use /attendance-update-to-full if you report a partial in the morning, but it becomes a full day \n-Use /attendance-check-total to see your current absence total \n-Use /attendance-policy to see the attendance policy\n*Troubleshooting:* You'll know it worked if you get a message back with your total absences. If you get a timeout error, try again right away"
}

var adminHowTo = {
  "type": "message",
  "response_type": "in_channel",
  "text": "Welcome to admin attendance bot! \nSlack the following commands directly to a student as necessary: \n-Use /attendance-unexcused-partial if someone's misses attendance and is unexcused \n-Use /attendance-unexcused-full if someone is unexcused for the whole day \n-Use /attendance-unexcused-update to change a partial to an unexcused full \n-Use /attendance-remove to remove the most recent reported absence. At this time this command can only be used once at a time. Contact Peter Ostiguy to remove multiple absences\n\n*Troubleshooting:* \n -If any of these commands give a timeout error, try again right away.\n-You'll have to add the Admin Attendance app to any convos you use this in\n-The student must have slacked you previously in a direct message"
}

function unexcusedMessage(totalAll, totalUnexcused) {
  return {
    "type": "message",
    "response_type": "in_channel",
    "text": "You're unexcused today. Please let us know when you'll be out!  Total Absences: " + totalAll + " and Total Unexcused Absences: " + totalUnexcused
  }
}

function standardMessage(totalAll, totalUnexcused) {
  return {
    "type": "message",
    "response_type": "in_channel",
    "text": "Total Absences: " + totalAll + " and Total Unexcused Absences: " + totalUnexcused
  }
}

function removeMessage(totalAll, totalUnexcused) {
  return {
    "type": "message",
    "response_type": "in_channel",
    "text": "Your most recent absence has been removed. Total Absences: " + totalAll + " and Total Unexcused Absences: " + totalUnexcused
  }
}

function unexcusedCorrection(totalAll, totalUnexcused) {
  return {
    "type": "message",
    "response_type": "in_channel",
    "text": "You're unexcused today. This is correcting this morning's partial to a full absence. Please let us know when you'll be out!  Total Absences: " + totalAll + " and Total Unexcused Absences: " + totalUnexcused
  }
}

function findMostRecent(dates, studentData) {
  var datesAbsent = Object.keys(dates)
  var allAbsences = []
  for(i=0;i<datesAbsent.length;i++){
    if (studentData[datesAbsent[i]] !== 'exists') {
      newEntry = {}
      newEntry.type = studentData.dates[datesAbsent[i]]
      newEntry.date = new Date(datesAbsent[i])
      allAbsences.push(newEntry)
    }
    else {
      datesAbsent.splice(i, 1)
    }
  }
  allAbsences.sort(function(a,b){
    return a.date - b.date
  })
  return datesAbsent = allAbsences.reverse()[0]
}

function addAbsence(currentDates, type) {
  currentDates[new Date()] = type
  return currentDates
}

function updateData(name, totalAll, totalUnexcused, dates) {
  return {
    name: name,
    total: totalAll,
    unexcused: totalUnexcused,
    dates: dates
  }
}

function executeAbsence(snapshot, type, addStandard, addUnexcused, createMessage, res) {
  var studentData = snapshot.val()
  if (new Date() - findMostRecent(studentData.dates, studentData).date > 600000) {
    studentRef.set(updateData(studentData.name, (studentData.total + addStandard), (studentData.unexcused + addUnexcused), addAbsence(studentData.dates, type)))
    res.send(createMessage((studentData.total + addStandard), studentData.unexcused + addUnexcused))
  }
  else {
    res.send(createMessage(studentData.total, studentData.unexcused))
  }
}

function executeRemove(snapshot, res) {
  var studentData = snapshot.val()
  var mostRecentType = findMostRecent(studentData.dates, studentData).type
  switch (mostRecentType) {
    case "partial":
      studentRef.set(updateData(studentData.name, (studentData.total - 1), studentData.unexcused, addAbsence(studentData.dates, "removed most recent partial")))
      res.send(removeMessage((studentData.total-1), studentData.unexcused))
      break;
    case "partial day unexcused":
      studentRef.set(updateData(studentData.name, (studentData.total - 1), (studentData.unexcused - 1), addAbsence(studentData.dates, "removed most recent partial day unexcused")))
      res.send(removeMessage((studentData.total-1),(studentData.unexcused-1)))
      break;
    case "whole day unexcused":
      studentRef.set(updateData(studentData.name, (studentData.total - 3), (studentData.unexcused - 3), addAbsence(studentData.dates, "removed most recent whole day unexcused")))
      res.send(removeMessage((studentData.total-3), (studentData.unexcused-3)))
      break;
    case "whole day":
      studentRef.set(updateData(studentData.name, (studentData.total - 3), studentData.unexcused, addAbsence(studentData.dates, "removed most recent whole day")))
      res.send(removeMessage((studentData.total-3), studentData.unexcused))
      break;
    case "partial to full unexcused":
      studentRef.set(updateData(studentData.name, (studentData.total - 2), (studentData.unexcused - 2), addAbsence(studentData.dates, "removed most recent partial to full unexcused")))
      res.send(removeMessage((studentData.total-2),(studentData.unexcused-2)))
      break;
    case "corrected to full":
      studentRef.set(updateData(studentData.name, (studentData.total - 2), studentData.unexcused, addAbsence(studentData.dates, "removed most recent correct to full")))
      res.send(removeMessage((studentData.total-2),(studentData.unexcused)))
      break;
    default:
      res.send("No absences eligible for removal at this time")
  }
}

module.exports = router
