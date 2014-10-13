// arms a target with drag-and-drop callbacks
var drop = require("drop.js");

// reads in querystring-like params from the location hash
var params = require("params.js");

// basic visible logging
var filelog = require("log.js")("file-log");
var awslog = require("log.js")("aws-log");

// basic file streaming, thank you @maxogden
var createReadStream = require('filereader-stream');

// AWS SDK, used for ease of handling multipart uploads
var AWS = require("aws-sdk-2.0.19.min.js");


var s3Stream = require('s3-upload-stream.js');


// AWS creds
//   key: access key
//   secret_key: secret key
//   bucket: bucket name
AWS.config.update({
  accessKeyId: params.key,
  secretAccessKey: params.secret_key
});

s3Stream.client(new AWS.S3());

/** various progress functions **/

// counter of MBs
var MBs = 5;
var MB = 1000 * 1000;
var next = 1;
var printMegabytes = function(progress) {
  if (progress > (next * (MBs * MB))) {
    var current = parseInt(progress / (MBs * MB)) * MBs;
    filelog("MBs: " + current);
    next = parseInt((current + MBs) / MBs);
  }
}

// less 1/128th of the bytes
var adjust = function(x) {return x - (x/128)};

/** manage file and AWS streams */

var uploadFile = function(file) {

  /**
  * Create the file reading stream.
  **/

  var stream = createReadStream(file, {
    output: "binary",
    chunkSize: adjust(1 * 1024 * 1024)
  });

  stream.on('progress', printMegabytes);

  stream.on('end', function(size) {
    filelog("Done: " + size);
  });

  stream.on('error', function(err, data) {
    console.log(err);
  })

  filelog(file.name +  ": embarking on a " + file.size + "-byte voyage.");


  /**
  * Create the upload stream.
  **/
  var upload = new s3Stream.upload({
    "Bucket": params.bucket,
    "Key": file.name,
    "ContentType": file.type,
    "ACL": "public-read"
  });

  upload.on('error', function(err, data) {
    console.log(err);
    window.arguments = arguments;
  })

  // by default, part size means a 50GB max (1000 part limit)
  // by raising part size, we increase total capacity
  if (file.size > (50 * 1024 * 1024 * 1024)) {
    var newSize = file.size / 900;
    upload.maxPartSize(newSize); // 900 for buffer
    awslog("Adjusting part size: " + newSize);
  } else {
    upload.maxPartSize(5242880);
  }

  // 1 at a time for now
  upload.concurrentParts(1);

  upload.on('part', function(data) {
    awslog("Part " + data.PartNumber + ": " + data.ETag);
  });

  upload.on('uploaded', function(data) {
    awslog("Done! <a href=\"" + data.Location + "\">" + data.Location + "</a>");
  })


  // up to S3!
  stream.pipe(upload);
};




drop(document.body, function(files) {
  uploadFile(files[0]);
});

console.log("Drop target armed.")
