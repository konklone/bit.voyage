## Bit Voyage

[![working-demo](https://cloud.githubusercontent.com/assets/4592/4611627/3244f16a-52bd-11e4-9d5d-1597844b342a.png)](#working-demo)

**[Jump to the working demo.](#working-demo)**

**Vision:** Allow anyone with a modern browser to drag, drop, and stream a 1GB, 10GB, 100GB, or 1TB file over the Internet to a happy home.

**Requirements:** Files should never be read entirely into memory at any stage. File progress should be real-time and clear. Uploads should be resumable and pause-able at any time.

**Implementation:**

* Use the [Drag and Drop API](http://blog.teamtreehouse.com/implementing-native-drag-and-drop), available [in modern desktop browsers](http://caniuase.com/#feat=dragndrop), to let anyone drag a file into their browser
* Use the [File API](http://docs.webplatform.org/wiki/apis/file), available [in modern browsers](http://caniuse.com/#feat=fileapi), to chunk and stream file objects in-browser
* Use the [FileReader object](https://developer.mozilla.org/en-US/docs/Web/API/FileReader), available [in modern browsers](http://caniuse.com/#feat=filereader), to read the contents of chunks into memory

**Goals:**

* **Short-term:** Use the [S3 Multipart Upload API](http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingRESTAPImpUpload.html) to allow users to upload files of any size directly to S3. (**Update:** this is working, for up to ~100GB.)
* **Long-term:** Allow upload to servers which support the Amazon S3 API but provide their own layer of authentication. Example: [The Internet Archive](https://archive.org/help/abouts3.txt).
* **Longest-term:** Instead of S3, allow users to stream files directly to other users over WebRTC, in the style of [Sharefest.me](https://www.sharefest.me/), as long as their browser tab is open.

### Working demo

A working demo is available at [bit.voyage](http://bit.voyage). It lets you drag files of up to around **100GB** into an S3 bucket. Files much larger than that will cause your browser to try to send very large parts, and files of around the 1TB range may crash your browser (like they did mine).

* Enter your S3 credentials into the URL **hash** (not the query string):

```
http://bit.voyage/#bucket=[your-bucket]&key=[your-key]&secret_key=[your-secret-key]
```

* Make sure your S3 bucket [has CORS enabled](http://docs.aws.amazon.com/AmazonS3/latest/dev/cors.html). Use the following CORS configuration, changing `http://bit.voyage` to `*` if you want it to work with more domains.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <CORSRule>
        <AllowedOrigin>http://bit.voyage</AllowedOrigin>
        <AllowedMethod>HEAD</AllowedMethod>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>DELETE</AllowedMethod>
        <ExposeHeader>ETag</ExposeHeader>
        <AllowedHeader>*</AllowedHeader>
    </CORSRule>
</CORSConfiguration>
```

Next steps include:

* Petitioning the Internet Archive to add CORS to their [S3-like API](https://archive.org/help/abouts3.txt).
* Making a new UI.
* Resuming very large downloads. I have yet to actually store a complete 100GB file, because of the time involved.

### Getting to 1TB+

For Amazon S3, this will require making 100MB+ HTTP POST requests, which realistically can only be done by a server. So, this involves:

* Finding or making a websocket stream library that can receive file data.
* Finding or making a thin web server that can receive websocket data and make authorized multipart uploads to S3.
* Being able to handle backpressure from the server all the way down to reading the file.
* Sending progress/etc events down the wire as well.

One interesting project is @maxogden's [`abstract-blob-store`](https://github.com/maxogden/abstract-blob-store), which aims to present a consistent interface to streaming blobs up and down anything that supports a stream. It's a little nascent, and doesn't yet have the semantics to support resumption, but it feels like the right direction.



### Credits

Created by [Eric Mill](https://twitter.com/konklone).

Builds on work by [Brian Brennan](https://github.com/brianloveswords/fileliststream), [Max](https://github.com/maxogden/filereader-stream) [Ogden](https://github.com/DamonOehlman/filestream/issues/9#issuecomment-58468336), [Derrick Parkhurst](https://github.com/thirtysixthspan/waterunderice), and [Young Hahn](https://github.com/mapbox/frameup).

### Public domain

This project is [dedicated to the public domain](LICENSE). As spelled out in [CONTRIBUTING](CONTRIBUTING.md):

> The project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).

> All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to comply with this waiver of copyright interest.
