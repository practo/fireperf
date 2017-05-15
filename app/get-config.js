var AWS = require('aws-sdk');
var s3 = new AWS.S3({signatureVersion: 'v4', region: 'ap-southeast-1', apiVersion: '2012-11-05'});

var params = {
  Bucket: process.env.BUCKET_NAME,
  Key: process.env.CONFIG_PATH
};

var file = require('fs').createWriteStream('./config.js');

s3
  .getObject(params)
  .createReadStream()
  .pipe(file);
