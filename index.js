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

// active upload
var active = {
  originalOffset: 0
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
$(".param").keyup(function() {
  console.log("changed value.");
  session.bucket = $(".bucket").val();
  session.key = $(".access-key").val();
  session["secret-key"] = $(".secret-key").val();
  initAWS();
  utils.updateLink(qs, session);
});

// S3 credentials testing
$(".s3.test").click(function() {
  $(".s3-test").hide();
  $(".s3-test.loading").show();

  awsClient.listObjects({Bucket: session.bucket}, function(err, objects) {
    $(".s3-test").hide();
    if (err) {
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

/**
 * Initializing and updating the current upload.
 * Used by 'part' event handler for S3 stream.
 */

function updateUpload() {

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

  // log MBs read to dev console
  fstream.on('progress', utils.mbCounter());
  fstream.on('progress', function(progress) {
    var pct = Math.floor((progress/file.size) * 100);
    $(".progress .reading").css("width", pct + "%");
  });

  fstream.on('pause', function(offset) {
    console.log("filereader-stream: PAUSE at " + offset);
  });

  fstream.on('resume', function(offset) {
    console.log("filereader-stream: RESUME at " + offset);
  });

  fstream.on('end', function(size) {
    console.log("filereader-stream: END at " + size);
    $(".progress .reading").css("width", "100%");
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

  // by default, part size means a 50GB max (10000 part limit)
  // by raising part size, we increase total capacity
  if (file.size > (50 * 1024 * 1024 * 1024)) {
    var newSize = parseInt(file.size / 9500);
    upload.maxPartSize(newSize); // 9500 for buffer
    log("Will be uploading " + utils.display(newSize) + " chunks to S3.");
    console.log("Part size should be: " + newSize);
  } else {
    upload.maxPartSize(5 * 1024 * 1024);
  }

  // 1 at a time for now
  upload.concurrentParts(1);

  upload.on('part', function(data) {
    var progress = active.originalOffset + data.uploadedSize;
    var pct = Math.floor((progress/file.size) * 100);

    var parts = Math.ceil(file.size / upload.getMaxPartSize());
    log("Uploaded part " + data.PartNumber + "/" + parts + ", " + utils.display(progress) + "/" + utils.display(file.size) + " (" + pct + "%).");
    console.log("s3-upload-stream: PART " + data.PartNumber + " / " + parts);

    $(".progress .voyage").css("width", pct + "%");
  });

  upload.on('uploaded', function(data) {
    log("Arrived! Download <strong>" + file.name + "</strong> at " +
      "<a href=\"" + data.Location + "\">" +
        data.Location +
      "</a>"
    );

    $(".control").hide();

    console.log("s3-upload-stream: UPLOADED.");
  });

  upload.on('error', function(err) {
    log("Error uploading file: " + err);
    console.log("s3-upload-stream: ERROR, " + err);
  });

  upload.on('ready', function(uploadId) {
    console.log("s3-upload-stream: READY, upload ID created.");
    log("Upload initiated, beginning to transfer parts.")

    $(".control.pause").show();
  });

  upload.on('pausing', function(pending) {
    console.log("s3-upload-stream: PAUSING, " + pending + " parts in the air.")
    log("<strong>Pausing download, do not close tab</strong>, still " + pending + " " + utils.display(upload.getMaxPartSize()) + " part(s) waiting to finish uploading.")
  });

  upload.on('paused', function(data) {
    console.log("s3-upload-stream: PAUSED. uploadId: " + data.UploadId + ", parts: " + data.Parts.length + ", uploaded: " + data.Uploaded);
    log("OK, fully paused.");

    // switch indicator
    $(".control").hide();
    $(".control.resume").show();

    // the Uploaded value will be relative to the creation of this stream
    // instance, so needs to be based off offset from before the stream
    // instance was created.
    params.offset = active.originalOffset + data.Uploaded;
    params.UploadId = data.UploadId;
    params.Parts = data.Parts;
  });

  upload.on('resume', function() {
    console.log("s3-upload-stream: RESUMED.");
  });

  // begin the voyage
  log("<strong>" + file.name + "</strong> is embarking on a " + utils.display(file.size) + " voyage.")
  $(".progress .voyage, .progress .reading").css("width", "0%");
  $(".control").hide();

  fstream.pipe(upload);
};


// S3 pause/resume - the user's pause/resume
$(".control.pause").click(function() {
  if (upload){
    upload.pause();
    $(".control").hide();
    $(".control.pausing").show();
  }
  return false;
});

$(".control.resume").click(function() {
  if (upload) {
    upload.resume();
    $(".control").hide();
    $(".control.pause").show();
  }
  return false;
});


drop(document.body, function(files) {if (files[0]) uploadFile(files[0]);});
console.log("Drop target armed.")
