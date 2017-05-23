require('console.table');

const Lighthouse = require('lighthouse');
const ChromeLauncher = require('lighthouse/lighthouse-cli/chrome-launcher.js').ChromeLauncher;
const request = require('request');
const rpn = require('request-promise-native');
const AWS = require('aws-sdk')
const testConfig = require('./lighthouse-config');

let mysql      = require('mysql');
let connection = mysql.createConnection({
  host     : process.env.db_host,
  user     : process.env.db_user,
  password : process.env.db_password,
  database : process.env.db_name
});

let messages = require('./messages');

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

let currentRun = 0;

let runTest = () => {
  console.time("~ Time taken to run the test:");
  let message = messages[currentRun % messages.length];

  console.log('\n\n---------------------------------------------------------------------------------')
  console.log('---------------------------------------------------------------------------------')
  console.log(`\n ~ [ ${currentRun + 1} ] Test will be run for: \n`)
  console.table(message);

  let flags = {
    'output': 'json',
    'disableDeviceEmulation': message.devicePlatform === 'DESKTOP' ? true : false,
    'disableCpuThrottling': false
  };

  let launcher = new ChromeLauncher({port: 9222, autoSelectChrome: true});

  launcher
  .isDebuggerReady()
  .catch(() => {
    return launcher.run();
  })
  .then(() => {
    console.log('~ Test started')
    return Lighthouse(message.pageUrl, flags, testConfig)
  })
  .then(results => launcher.kill().then(() => {
    console.log('~ Success. Launcher killed. \n')
    return results
  }))
  .catch(err => {
    return launcher.kill().then(() => {
      console.log('~ Failure. Launcher killed')
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
    formValues['name'] = message.pageName;
    formValues['group'] = message.pageGroup;
    formValues['platform'] = message.devicePlatform;

    writeTestData(formValues);
    console.table(values);
    console.timeEnd("~ Time taken to run the test:");

    currentRun++;

    runTest();
  })
  .catch(err => console.error(err));
}

runTest();
