var drop = require("drop.js");
var params = require("params.js");
var filelog = require("log.js")("file-log");
var awslog = require("log.js")("aws-log");
var echo = require("echo.js");

// basic file streaming, thank you @maxogden
var createReadStream = require('filereader-stream');

// s3-upload-stream + AWS SDK
var s3Stream = require('s3-upload-stream');

var AWS = require("archive");
// var AWS = require("aws-sdk");

AWS.config.update({
  accessKeyId: params.key,
  secretAccessKey: params.secret_key
});
s3Stream.client(new AWS.S3());

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



/** manage file and AWS streams */

var uploadFile = function(file) {

  /**
  * Create the file reading stream.
  **/

  var fstream = createReadStream(file, {
    output: "binary",
    chunkSize: (1 * 1024 * 1024)
  });

  fstream.on('progress', printMegabytes);

  fstream.on('pause', function(offset) {
    console.log("filereader-stream has PAUSED at " + offset);
  });

  fstream.on('resume', function(offset) {
    console.log("filereader-stream has RESUMED at " + offset);
  });

  fstream.on('end', function(size) {
    filelog("Done: " + size);
  });

  fstream.on('error', function(err, data) {
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
    upload.maxPartSize(5 * 1024 * 1024);
  }

  // 1 at a time for now
  upload.concurrentParts(1);

  upload.on('part', function(data) {
    awslog("Part " + data.PartNumber + ": " + data.ETag);
  });

  upload.on('uploaded', function(data) {
    awslog("Done! <a href=\"" + data.Location + "\">" + data.Location + "</a>");
  })


  // debugging, will hold chunks for X ms and echo length
  // fstream.pipe(echo(1000));

  // up to S3!
  fstream.pipe(upload);

};


drop(document.body, function(files) {uploadFile(files[0]);});
console.log("Drop target armed.")
