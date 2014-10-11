## Drag and drop anything into S3

**Goal:** Allow anyone with a modern browser to drag, drop, and stream a 1GB, 10GB, or 1TB file into Amazon S3.

**Requirements:** Files should never be read entirely into memory at any stage. File progress should be real-time and clear. Uploads should be resumable and pause-able at any time.

**Implementation:**

* Use the [Drag and Drop API](http://blog.teamtreehouse.com/implementing-native-drag-and-drop), available [in modern desktop browsers](http://caniuse.com/#feat=dragndrop), to let anyone drag a file into their browser
* Use the [File API](http://docs.webplatform.org/wiki/apis/file), available [in modern browsers](http://caniuse.com/#feat=fileapi), to chunk and stream file objects in-browser
* Use the [FileReader object](https://developer.mozilla.org/en-US/docs/Web/API/FileReader), available [in modern browsers](http://caniuse.com/#feat=filereader), to read the contents of chunks into memory
* **Short-term goal:** Use [WebSockets](http://docs.webplatform.org/wiki/apis/websocket), [available in modern browsers](http://caniuse.com/#feat=websockets), to send these chunks to a server over a controlled stream. The server should then stream received data into an S3 bucket.
* **Long-term goal:** Instead of WebSockets, use the [AWS JS SDK](http://aws.amazon.com/sdk-for-browser/) and the [S3 Multipart Upload API](http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingRESTAPImpUpload.html) to allow users to upload directly to S3. Access credentials would either be entered by users, or bookmarked in the URL's hash fragment.

### Credits

Created by [Eric Mill](https://twitter.com/konklone).

Builds on work by [Max Ogden](https://github.com/maxogden/filereader-stream), [Derrick Parkhurst](https://github.com/thirtysixthspan/waterunderice), and [Young Hahn](https://github.com/mapbox/frameup).

### Public domain

This project is [dedicated to the public domain](LICENSE). As spelled out in [CONTRIBUTING](CONTRIBUTING.md):

> The project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](http://creativecommons.org/publicdomain/zero/1.0/).

> All contributions to this project will be released under the CC0 dedication. By submitting a pull request, you are agreeing to comply with this waiver of copyright interest.
