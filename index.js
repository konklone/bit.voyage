/**
 * npm and local dependencies.
**/

var qs = require("qs");
var FileReaderStream = require('filereader-stream'); // thank you @maxogden
var s3Stream = require('s3-upload-stream'); // thank you @nathanpeck
var AWS = require("aws-sdk"); // thank you @lsegal

var drop = require("./assets/js/drop.js");
var utils = require("./assets/js/utils.js");
var db = require("./assets/js/db.js");

/**
 * Load in any state from the URL, and initialize bit vehicles.
**/

// initial load of parameters
var params = qs.parse(location.hash ? location.hash.replace("#", "") : null);

// session, can be changed throughout
var session = {
  key: params.key,
  "secret-key": params['secret-key'],
  bucket: params.bucket
};

// load offset as a number, cache the starting offset for this session.
// if (params.offset) params.offset = parseInt(params.offset);
// var originalOffset = params.offset || 0;

// configure AWS
var awsClient;
function initAWS() {
  AWS.config.update({
    accessKeyId: session.key,
    secretAccessKey: session["secret-key"]
  });
  awsClient = new AWS.S3();
}
initAWS();
s3Stream.client(awsClient);

var fstream;
var upload;
var log = utils.log("main-log");


/**
 * Initialize destination parameters.
*/

$(".bucket").val(params.bucket);
$(".access-key").val(params.key);
$(".secret-key").val(params['secret-key']);

// changing values updates session automatically
$(".param").click(function() {$(this).select(); return false;})
$(".param").keyup(function() {
  console.log("changed value.");
  session.bucket = $(".bucket").val();
  session.key = $(".access-key").val();
  session["secret-key"] = $(".secret-key").val();
  initAWS();
  utils.updateLink(qs, session);
});

$(".s3.test").click(function() {
  awsClient.listObjects({Bucket: session.bucket}, function(err, objects) {
    if (err) {
      $(".s3-test").hide();
      if (err.name == "NetworkingError")
        $(".s3-test.cors").show();
      else
        $(".s3-test.credentials").show();
    } else {
      $(".s3-test").hide();
      $(".s3-test.success").show();
    }
  });
});

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

  // log MBs read to dev console
  fstream.on('progress', utils.mbCounter());

  // TODO: update progress bar

  fstream.on('pause', function(offset) {
    console.log("filereader-stream: PAUSE at " + offset);
  });

  fstream.on('resume', function(offset) {
    console.log("filereader-stream: RESUME at " + offset);
  });

  fstream.on('end', function(size) {
    console.log("filereader-stream: END at " + size);
  });

  fstream.on('error', function(err, data) {
    console.log(err);
  })

  params.filename = file.name;


  /**
  * Create the upload stream.
  **/

  upload = new s3Stream.upload({
    "Bucket": params.bucket,
    "Key": file.name,
    "ContentType": file.type,
    "ACL": "public-read"
  });

  upload.on('error', function(err, data) {
    console.log(err);
    window.arguments = arguments;
  })

  // by default, part size means a 50GB max (10000 part limit)
  // by raising part size, we increase total capacity
  if (file.size > (50 * 1024 * 1024 * 1024)) {
    var newSize = parseInt(file.size / 9500);
    upload.maxPartSize(newSize); // 9500 for buffer
    log("Adjusting part size: " + display(newSize));
    console.log("Part size should be: " + newSize);
  } else {
    upload.maxPartSize(5 * 1024 * 1024);
  }

  // 1 at a time for now
  upload.concurrentParts(1);

  upload.on('part', function(data) {
    log("Part " + data.PartNumber + ": " + data.ETag);
    console.log("s3-upload-stream: PART " + data.PartNumber);
  });

  upload.on('uploaded', function(data) {
    log("Done! " +
      "<a href=\"" + data.Location + "\">" +
        data.Location +
      "</a>"
    );

    // clean up session details from params
    // delete params.UploadId;
    // delete params.Parts;
    // delete params.filename;
    // delete params.offset;

    console.log("s3-upload-stream: UPLOADED.");
  });

  upload.on('error', function(err) {
    log("Error uploading file: " + err);
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
  });

  upload.on('resume', function() {
    console.log("s3-upload-stream: RESUMED.");
  });

  fstream.pipe(upload);
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


drop(document.body, function(files) {if (files[0]) uploadFile(files[0]);});
console.log("Drop target armed.")
