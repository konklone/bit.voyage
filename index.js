var drop = require("drop.js");
var Qs = require("qs");
var filelog = require("log.js")("file-log");
var awslog = require("log.js")("aws-log");
var echo = require("echo.js");

// initial load of parameters
var qs = location.hash ? location.hash.replace("#", "") : null;
var params = Qs.parse(qs);
if (params.offset) params.offset = parseInt(params.offset);
var originalOffset = params.offset || 0;

// default permalink
var updateLink = function(params) {
  var link = window.location.protocol + "//" + window.location.host + "/#" + Qs.stringify(params);

  var perm = document.getElementById("permalink");
  perm.innerHTML = link;
  perm.href = link;

  window.location = link;

  return false;
}

// basic file streaming, thank you @maxogden
var FileReaderStream = require('filereader-stream');

// s3-upload-stream + AWS SDK
var s3Stream = require('s3-upload-stream');
var AWS = require("aws-sdk");
AWS.config.update({
  accessKeyId: params.key,
  secretAccessKey: params.secret_key
});
s3Stream.client(new AWS.S3());

var session = {};
if (params.UploadId) {
  session.UploadId = params.UploadId;
  session.Parts = params.Parts;

  awslog("Drop " + params.filename + " to resume your download.")
};

// instantiated streams
var fstream;
var upload;

// file pause/resume - useful for debugging
document.getElementById("file-pause").onclick = function() {
  if (fstream) fstream.pause();
  return false;
};

document.getElementById("file-resume").onclick = function() {
  if (stream) fstream.resume();
  return false;
};

// S3 pause/resume - the user's pause/resume
document.getElementById("upload-pause").onclick = function() {
  if (upload) upload.pause();
  return false;
};

document.getElementById("upload-resume").onclick = function() {
  if (upload) upload.resume();
  return false;
};

// counter of MBs
var MBs = 5;
var MB = 1000 * 1000;
var next = 1;
var printMegabytes = function(progress) {
  if (progress > (next * (MBs * MB))) {
    var current = parseInt(progress / (MBs * MB)) * MBs;
    console.log("filereader-stream: MBs: " + current);
    next = parseInt((current + MBs) / MBs);
  }
}

function display(bytes) {
  if (bytes > 1e9)
    return (bytes / 1e9).toFixed(2) + 'GB';
  else if (bytes > 1e6)
    return (bytes / 1e6).toFixed(2) + 'MB';
  else
    return (bytes / 1e3).toFixed(2) + 'KB';
};



/** manage file and AWS streams */

var uploadFile = function(file) {

  /**
  * Create the file reading stream.
  **/

  fstream = FileReaderStream(file, {
    output: "binary",
    chunkSize: (1 * 1024 * 1024),
    offset: params.offset
  });

  fstream.on('progress', printMegabytes);
  // fstream.on('progress', function(msg) {console.log(msg)}); // heavy!

  fstream.on('pause', function(offset) {
    console.log("filereader-stream: PAUSE at " + offset);
  });

  fstream.on('resume', function(offset) {
    console.log("filereader-stream: RESUME at " + offset);
  });

  fstream.on('end', function(size) {
    filelog("Done: " + size);
    console.log("filereader-stream: END at " + size);
  });

  fstream.on('error', function(err, data) {
    console.log(err);
  })

  filelog(file.name +  ": embarking on a " + file.size + "-byte voyage.");
  params.filename = file.name;


  /**
  * Create the upload stream.
  **/

  upload = new s3Stream.upload({
    "Bucket": params.bucket,
    "Key": file.name,
    "ContentType": file.type,
    "ACL": "public-read"
  }, session);

  upload.on('error', function(err, data) {
    console.log(err);
    window.arguments = arguments;
  })

  // by default, part size means a 50GB max (10000 part limit)
  // by raising part size, we increase total capacity
  if (file.size > (50 * 1024 * 1024 * 1024)) {
    var newSize = parseInt(file.size / 9500);
    upload.maxPartSize(newSize); // 9500 for buffer
    awslog("Adjusting part size: " + display(newSize));
    console.log("Part size should be: " + newSize);
  } else {
    upload.maxPartSize(5 * 1024 * 1024);
  }

  // 1 at a time for now
  upload.concurrentParts(1);

  upload.on('part', function(data) {
    awslog("Part " + data.PartNumber + ": " + data.ETag);
    console.log("s3-upload-stream: PART " + data.PartNumber);
  });

  upload.on('uploaded', function(data) {
    awslog("Done! " +
      "<a href=\"" + data.Location + "\">" +
        data.Location +
      "</a>"
    );

    // clean up session details from params
    delete params.UploadId;
    delete params.Parts;
    delete params.filename;
    delete params.offset;

    updateLink(params);

    console.log("s3-upload-stream: UPLOADED.");
  });

  upload.on('error', function(err) {
    awslog("Error uploading file: " + err);
    console.log("s3-upload-stream: ERROR, " + err);
  });

  upload.on('ready', function(uploadId) {
    console.log("s3-upload-stream: READY, upload ID created.");
  });

  upload.on('pausing', function(pending) {
    console.log("s3-upload-stream: PAUSING, " + pending + " parts in the air.")
  });

  upload.on('paused', function(data) {
    console.log("s3-upload-stream: PAUSED. uploadId: " + data.UploadId + ", parts: " + data.Parts.length + ", uploaded: " + data.Uploaded);

    // the Uploaded value will be relative to the creation of this stream
    // instance, so needs to be based off offset from before the stream
    // instance was created.
    params.offset = originalOffset + data.Uploaded;
    params.UploadId = data.UploadId;
    params.Parts = data.Parts;

    updateLink(params);
  });

  upload.on('resume', function() {
    console.log("s3-upload-stream: RESUMED.");
  });

  // debugging, will hold chunks for X ms and echo length
  // fstream.pipe(echo(1000));

  // up to S3!
  fstream.pipe(upload);

};

// initialize permalink to window.location
updateLink(params);

drop(document.body, function(files) {if (files[0]) uploadFile(files[0]);});
console.log("Drop target armed.")
