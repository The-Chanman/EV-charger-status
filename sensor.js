const Nomad = require('nomad-stream')
const moment = require('moment')

const credentials = require('./twilio-login.js')
const phoneNumbers = require('./phone-numbers.js')

const nomad = new Nomad()

//require the Twilio module and create a REST client
const client = require('twilio')(credentials.accountSid, credentials.authToken)

// device atomic node ids
const subscriptions = ['QmQHRpzmBAPMrmmApUYjg1NUTcZtbiSqc5PA7wsVNv6Mp6', 'QmXe1Lo3ghMNoVrxKHQkBG6cdR4TJUSmdNAZa9paqnqDGi']

let instance
let lastPub
let notificationBody
let lastStatus1 = false
let lastStatus2 = false

const frequency =  2 * 60 * 1000 // 2 minutes  
const timeThreshold = 4 * 60 * 60 * 1000 // 4 hours
const toNumber = phoneNumbers.toNumber
const fromNumber = phoneNumbers.fromNumber

const defaultPublishData = { 
  [subscriptions[0]]: {
    charging_station: {
      data: '',
      time: '',
      description: '',
      price: 5
    }
  },
  [subscriptions[1]]: {
    charging_station: {
      data: '',
      time: '',
      description: '',
      price: 4
    }
  }
}

// How we manager the data
class DataMaintainer {
  constructor(){
    this.data = defaultPublishData
  }
  setValue(id, key, value){
    let cleanedKey = this.cleanKey(key)
    if(cleanedKey in this.data[id]){
      this.data[id][cleanedKey].data = value.data
      this.data[id][cleanedKey].time = value.time
      this.data[id][cleanedKey].description = value.description
    } else {
      this.data[id][cleanedKey] = value
    }
  }
  cleanKey(key){
    let cleanedKey = key.replace(/\s+/, '\x01').split('\x01')[0]
    cleanedKey = cleanedKey.toLowerCase()
    return cleanedKey
  }
  getAll(){
    return this.data
  }
  isAllFilled(){
    return this.data[subscriptions[0]]['charging_station']["data"] && this.data[subscriptions[0]]['charging_station']["time"] && this.data[subscriptions[1]]['charging_station']["data"] && this.data[subscriptions[1]]['charging_station']["time"]
  }
  clear(){
    this.data = defaultPublishData
  }
  toString(){
    return JSON.stringify(this.data)
  }
}

function getTime() {
  return new moment()
}

//init data manager
let dataManager = new DataMaintainer()

nomad.prepareToPublish()
  .then((n) => {
    instance = n
    return instance.publishRoot('Starting up EV charging station composite')
  })
  .then(() => {
    lastPub = getTime()
    nomad.subscribe(subscriptions, function(message) {
      console.log("Receieved a message for node " + message.id)
      console.log("Message was " + message.message)
      let messageData = JSON.parse(message.message)
      try{
        dataManager.setValue(message.id, Object.keys(messageData)[0],{data: messageData[Object.keys(messageData)[0]].data, time: messageData[Object.keys(messageData)[0]].time, description: messageData[Object.keys(messageData)[0]].description})
      }
      catch(err){
        console.log("DataMaintainer failed with error of " + err)
      }
      console.log(dataManager.toString())
      let currentTime = getTime()
      let timeSince = currentTime - lastPub
      if (timeSince >= frequency){
        console.log('===================================> timeSince >= timeBetween')
        let currentRecord = dataManager.getAll()
        let sensorOneData = currentRecord[Object.keys(currentRecord)[0]]['charging_station']["data"]
        let sensorTwoData = currentRecord[Object.keys(currentRecord)[1]]['charging_station']["data"]
        if ((sensorOneData == "unoccupied" && sensorOneData != lastStatus1) || (sensorTwoData == "unoccupied" && sensorTwoData != lastStatus2 )){
          console.log("***************************************************************************************")
          console.log(`we are now going to notify relevant parties since there is an unoccupied `)
          console.log("***************************************************************************************")

          if(sensorOneData == "unoccupied" && sensorTwoData == "unoccupied"){
            notificationBody = `EV Charger 1 and 2 are unoccupied. Prices are ${currentRecord[Object.keys(currentRecord)[0]]['charging_station']["price"]} and ${currentRecord[Object.keys(currentRecord)[1]]['charging_station']["price"]} respectively`
            client.messages.create({
              to: toNumber,
              from: fromNumber,
              body: notificationBody,
            }, function (err, message) {
              console.log(err)
              console.log(message)
            })
          } else if (sensorOneData == "unoccupied"){
            notificationBody = `EV Charger 1 is unoccupied and the price is ${currentRecord[Object.keys(currentRecord)[0]]['charging_station']["price"]}`
            client.messages.create({
              to: toNumber,
              from: fromNumber,
              body: notificationBody,
            }, function (err, message) {
              console.log(err)
              console.log(message)
            })

          } else if (sensorTwoData == "unoccupied"){
            notificationBody = `EV Charger 2 is unoccupied and the price is ${currentRecord[Object.keys(currentRecord)[1]]['charging_station']["price"]}`
            client.messages.create({
              to: toNumber,
              from: fromNumber,
              body: notificationBody,
            }, function (err, message) {
              console.log(err)
              console.log(message)
            })
          }

          instance.publish(dataManager.toString())
            .catch(err => console.log(`Error in publishing timeSince>=timeBetween positive state: ${JSON.stringify(err)}`))
          dataManager.clear()
          lastPub = currentTime
          lastStatus1 = sensorOneData
          lastStatus2 = sensorTwoData
        } else if (dataManager.isAllFilled()) {
          instance.publish(dataManager.toString())
            .catch(err => console.log(`Error in publishing timeSince>=timeBetween negative state: ${JSON.stringify(err)}`))
        }
      }
      if (timeSince >= timeThreshold){
        // let them know the node is still online
       console.log("===================================>   timeSince >= timeThreshold")
        console.log("***************************************************************************************")
        console.log('Heartbeat, I am alive but have not got data in a long time')
        console.log("***************************************************************************************")
        messageBody = 'Heartbeat, I am alive but have not got data in a long time'
        client.messages.create({
          to: toNumber,
          from: fromNumber,
          body: messageBody,
        }, function (err, message) {
          console.log(err)
          console.log(message)
        })
        instance.publish('Heartbeat, I am alive but have not got data in a long time')
          .catch(err => console.log(`Error in publishing timeSince>=timeBetween: ${JSON.stringify(err)}`))
        dataManager.clear()
        lastPub = currentTime
      }
    })
  })
  .catch(err => console.log(`Error in main loop: ${JSON.stringify(err)}`))