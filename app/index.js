require('console.table');

const Lighthouse = require('lighthouse');
const ChromeLauncher = require('lighthouse/lighthouse-cli/chrome-launcher.js').ChromeLauncher;
const request = require('request');
const rpn = require('request-promise-native');
const AWS = require('aws-sdk')
const testConfig = require('lighthouse-config');
const config = require('config');

const launcher = new ChromeLauncher({port: 9222, autoSelectChrome: true});
const flags = { output: 'json' };

function runTest(totalRuns, url, callback) {
  let currentRun = 0;

  let postTestData = (formUri) => {
    rpn({
        method: 'POST',
        uri: formUri,
        form: formValues
      })
    .then((error, response, body) => {
      if (!error && response.statusCode == 200) {
        console.log('\n ~ Results uploaded ~')
      }
    })
    .catch(err => console.log('\n ~ Received a StatusCode error'));
  }

  let runOnce = () => {
   launcher
    .isDebuggerReady()
    .catch(() => {
      return launcher.run();
    })
    .then(() => {
      console.log('-------- Starting lighthouse -------\n');
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
      formValues['generation-time'] = lighthouseResults.generatedTime;

      config.form_uri && postTestData(config.form_uri);

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
      console.log('\n ~ Done, deleting SQS message');
      callback()
    }
  }

  callRun();
}

var sqs = new AWS.SQS({region: 'ap-southeast-1', apiVersion: '2012-11-05'});

var queueURL = config.sqs_queue_url;

var params = {
  AttributeNames: ["SentTimestamp"],
  MaxNumberOfMessages: 1,
  MessageAttributeNames: ["All"],
  QueueUrl: queueURL,
  WaitTimeSeconds: 0,
  VisibilityTimeout: 0
};

sqs.receiveMessage(params, function(err, data) {
  if (err) {
    console.log("Error: SQS Message not received", err);
  } else {
    if(!data.Messages) {
      console.log('No message found');
      return;
    }

    // { "runs": 3, "url": "https://practo.com" }
    let message = JSON.parse(data.Messages[0].Body);

    let url = message.url;
    let runsCalled = 0;
    let totalRuns = message.runs || 3;

    calledRuns = 0;

    console.log(`Launching test runner with ~ ${totalRuns} runs, for URL ~ ${url}`);

    runTest(totalRuns, url, function() {
      var deleteParams = {
        QueueUrl: queueURL,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      };

      sqs.deleteMessage(deleteParams, function(err, data) {
        if (err) {
          console.log("Delete Error", err);
        } else {
          console.log("Message Deleted", data);
        }
      });
    });
  }
});
