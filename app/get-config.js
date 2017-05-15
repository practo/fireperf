var AWS = require('aws-sdk');
var s3 = new AWS.S3({signatureVersion: 'v4', region: 'ap-south-1', apiVersion: '2012-11-05'});

var params = {
  Bucket: process.env.BUCKET_NAME,
  Key: process.env.CONFIG_PATH
};

var file = require('fs').createWriteStream('/app/config.js');

s3
  .getObject(params, function(err) {
  })
  .createReadStream()
  .pipe(file)
  .on('error', function(error) {
    if(error) throw (error);
  })
