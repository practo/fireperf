require('console.table');

const Lighthouse = require('lighthouse');
const ChromeLauncher = require('lighthouse/lighthouse-cli/chrome-launcher.js').ChromeLauncher;
const request = require('request');
const rpn = require('request-promise-native');
const AWS = require('aws-sdk')
const testConfig = require('./lighthouse-config');
const config = require('./config');

const launcher = new ChromeLauncher({port: 9222, autoSelectChrome: true});

let mysql      = require('mysql');
let connection = mysql.createConnection({
  host     : config.database.host,
  user     : config.database.user,
  password : config.database.password,
  database : config.database.name
});

function runTest({ totalRuns, url, pageName, pageGroup, devicePlatform }, callback) {
  let currentRun = 0;

  let writeTestData = (formValues) => {
    let formattedValues = {};

    for(i in formValues) {
      formattedValues[i.replace(/-/g, '_')] = formValues[i];
    }

    var query = connection.query('INSERT INTO page_metrics SET ?', formattedValues, function (error, results, fields) {
      if (error) throw error;
      console.log('----- Completed -----');
    });
  }

  let runOnce = () => {
    let flags = {
      'output': 'json',
      'disableDeviceEmulation': devicePlatform === 'DESKTOP' ? true : false,
      'disableCpuThrottling': false
    };


    launcher
    .isDebuggerReady()
    .catch(() => {
      return launcher.run();
    })
    .then(() => {
      return Lighthouse(url, flags, testConfig)
    })
    .then(results => launcher.kill().then(() => results))
    .catch(err => {
      return launcher.kill().then(() => {
        throw err;
      }, console.error);
    })
    .then(lighthouseResults => {
      let initialUrl = lighthouseResults.initialUrl;
      let finalUrl = lighthouseResults.url;
      let values = [];
      let formValues = {};
      let audits = lighthouseResults.audits;

      lighthouseResults.artifacts = undefined;

      for(i in audits) {
        values.push({
          metric: audits[i].name,
          value: audits[i].rawValue
        })
        formValues[audits[i].name] = audits[i].rawValue;
      }

      formValues['url'] = finalUrl;
      formValues['name'] = pageName;
      formValues['group'] = pageGroup;
      formValues['platform'] = devicePlatform;

      writeTestData(formValues);

      console.log('Running for URL [', finalUrl, ']\n');
      console.table(values);

      callRun();
    })
    .catch(err => console.error(err));
  }

  function callRun() {
    if(currentRun < totalRuns) {
      currentRun++
      console.log('Running test - ', currentRun);
      runOnce();
    }
    else {
      callback()
    }
  }

  callRun();
}

// runTest({
//   "totalRuns": 1,
//   "url": "https://example.com",
//   "pageName": "Assign a readable name to this page",
//   "pageGroup": "A context / tag to assign to the page",
//   "devicePlatform": "DESKTOP"
// });

var sqs = new AWS.SQS({region: 'ap-southeast-1', apiVersion: '2012-11-05'});

var queueURL = config.sqs.url;

var params = {
  AttributeNames: ["SentTimestamp"],
  MaxNumberOfMessages: 1,
  MessageAttributeNames: ["All"],
  QueueUrl: queueURL,
  WaitTimeSeconds: 0
};

sqs.receiveMessage(params, function(err, data) {
  if (err) {
    console.log("Error: SQS Message not received", err);
  } else {
    if(!data.Messages) {
      console.log('No message found');
      return;
    }

    /*
     * Queue message format =>
     *
     * {
     *   "runs": 100,
     *   "url": "https://example.com",
     *   "page_name": "Assign a readable name to this page",
     *   "page_group": "A context / tag to assign to the page"
     * }
     */

    let message = JSON.parse(data.Messages[0].Body);

    let url = message.pageUrl;
    let runsCalled = 0;
    let totalRuns = message.testRuns || 3;
    let pageName = message.pageName;
    let pageGroup = message.pageGroup;
    let devicePlatform = message.devicePlatform;

    calledRuns = 0;

    console.log(`Launching test runner with ~ ${totalRuns} runs, for URL ~ ${url}`);

    runTest({ totalRuns, url, pageName, pageGroup, devicePlatform }, function() {
      var deleteParams = {
        QueueUrl: queueURL,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      };

      sqs.deleteMessage(deleteParams, function(err, data) {
        if (err) {
          console.log("Delete Error", err);
        } else {
          console.log("Message Deleted", data);
          var ecs = new AWS.ECS({ region: 'ap-southeast-1' });

          var params = {
            cluster: config.cluster.name
          };

          ecs.listTasks(params, function(err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else {
              params.task: data.taskArns[0];
              ecs.stopTask(params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else     console.log(data);           // successful response
              });
            }
          });
        }
      });
    });
  }
});
