var layoutContainer = document.getElementById("layoutContainer");
var options = {
    maxRatio: 3/2,             // The narrowest ratio that will be used (default 2x3)
    minRatio: 9/16,            // The widest ratio that will be used (default 16x9)
    fixedRatio: false,         // If this is true then the aspect ratio of the video is maintained and minRatio and maxRatio are ignored (default false)
    scaleLastRow: true,        // If there are less elements on the last row then we can scale them up to take up more space
    alignItems: 'center',      // Can be 'start', 'center' or 'end'. Determines where to place items when on a row or column that is not full
    bigClass: "OT_big",        // The class to add to elements that should be sized bigger
    bigPercentage: 0.8,        // The maximum percentage of space the big ones should take up
    minBigPercentage: 0,       // If this is set then it will scale down the big space if there is left over whitespace down to this minimum size
    bigFixedRatio: false,      // fixedRatio for the big ones
    bigScaleLastRow: true,     // scale last row for the big elements
    bigAlignItems: 'center',   // How to align the big items
    smallAlignItems: 'center', // How to align the small row or column of items if there is a big one
    maxWidth: Infinity,        // The maximum width of the elements
    maxHeight: Infinity,       // The maximum height of the elements
    smallMaxWidth: Infinity,   // The maximum width of the small elements
    smallMaxHeight: Infinity,  // The maximum height of the small elements
    bigMaxWidth: Infinity,     // The maximum width of the big elements
    bigMaxHeight: Infinity,    // The maximum height of the big elements
    bigMaxRatio: 3/2,          // The narrowest ratio to use for the big elements (default 2x3)
    bigMinRatio: 9/16,         // The widest ratio to use for the big elements (default 16x9)
    bigFirst: true,            // Whether to place the big one in the top left (true) or bottom right (false).
                               // You can also pass 'column' or 'row' to change whether big is first when you are in a row (bottom) or a column (right) layout
    animate: true,             // Whether you want to animate the transitions using jQuery (not recommended, use CSS transitions instead)
    window: window,            // Lets you pass in your own window object which should be the same window that the element is in
    ignoreClass: 'OT_ignore',  // Elements with this class will be ignored and not positioned. This lets you do things like picture-in-picture
    onLayout: null,            // A function that gets called every time an element is moved or resized, (element, { left, top, width, height }) => {}
};

// Initialize the layout container and get a reference to the layout method
var layout = initLayoutContainer(layoutContainer, options);
layout.layout();

// replace these values with those generated in your TokBox Account
var apiKey;
var sessionId;
var token;

// create canvas on which DeepAR will render
var deepARCanvas = document.createElement('canvas');

// Firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1572422
// canvas.captureStream causes an error if getContext not called before. Chrome does not need the line below.
var canvasContext = deepARCanvas.getContext('webgl');
var mediaStream = deepARCanvas.captureStream(25);
var videoTracks = mediaStream.getVideoTracks();
var deepAR;

axios.post("/init", {})
.then(result => {
  console.log("/init | ", result);
  if (result.status === 200) {
    apiKey = result.data ? result.data.apiKey : "";
    sessionId = result.data ? result.data.sessionId : "";
    token = result.data ? result.data.token : "";

    // start DeepAR
    startDeepAR(deepARCanvas);

    // start video call
    initializeSession(videoTracks[0]);
  }
})
.catch(error => {
  console.log(error);
});

// Handling all of our errors here by alerting them
function handleError(error) {
  console.log('handle error', error);
  if (error) {
    alert(error.message);
  }
}

function initializeSession(videoSource) {
  console.log("initializeSession");
  var session = OT.initSession(apiKey, sessionId);

  // Create a publisher
  var publisher = OT.initPublisher('publisherContainer', {
    insertMode: 'append',
    width: '100%',
    height: '100%',
    videoSource: videoSource
  }, handleError);

  // Connect to the session
  session.connect(token, function(error) {
    // If the connection is successful, publish to the session
    if (error) {
      console.log("SESSION CONNECT ERROR", error)
      handleError(error);
    } else {
      console.log("SESSION CONNECT SUCCESS")
      session.publish(publisher, handleError);

      layout.layout();
    }
  });

  session.on('streamCreated', function(event) {
    console.log("STREAM CREATED", event);
    session.subscribe(event.stream, 'layoutContainer', {
      insertMode: 'append',
      width: '100%',
      height: '100%'
    }, handleError);
    layout.layout();
  });

  session.on('streamDestroyed', (event) => {
    console.log("STREAM DESTROYED", event);
    event.preventDefault();
    session.getSubscribersForStream(event.stream).forEach((subscriber) => {
      subscriber.element.classList.remove('ot-layout');
      setTimeout(() => {
        subscriber.destroy();
        layout.layout();
      }, 200);
    });
  });

}

function startDeepAR(canvas) {
  console.log("startDeepAR");

  deepAR = DeepAR({
    canvasWidth: 640,
    canvasHeight: 480,
    licenseKey: 'ab5861f7f28e8eb0ec8e512ce9b4a0f1c401328c83f78015ceef510c95802ec3e41e9cf4b94ce3f7',
    libPath: './../deepar',
    segmentationInfoZip: 'segmentation.zip',
    canvas: canvas,
    numberOfFaces: 1,
    onInitialize: function() {
      // start video immediately after the initalization, mirror = true
      deepAR.startVideo(true);

      deepAR.switchEffect(0, 'slot', './effects/aviators', function() {
        // effect loaded
      });
    }
  });

  deepAR.downloadFaceTrackingModel('./deepar/models-68-extreme.bin');

  var filterIndex = 0;
  var filters = ['./effects/aviators','./effects/dalmatian','./effects/background_segmentation','./effects/background_blur','./effects/beauty'];
  var changeFilterButton = document.getElementById('change-filter-button');
  changeFilterButton.onclick = function() {
    filterIndex = (filterIndex + 1) % filters.length;
    deepAR.switchEffect(0, 'slot', filters[filterIndex]);
  }

  // Because we have to use a canvas to render to and then stream to the
  // Vonage publisher, changing tabs has to pause the video streaming otherwise it will cause a crash
  // by pausing the 'window.requestAnimationFrame', more can be seen in the documentation:
  // https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
  var visible = true;
  document.addEventListener("visibilitychange", function (event) {
    visible = !visible;
    // pause and resume are not required, but it will pause the calls to 'window.requestAnimationFrame'
    // and the entire rendering loop, which should improve general performance and battery life
    if (!visible) {
      deepAR.pause()
      deepAR.stopVideo();
    } else {
      deepAR.resume();
      deepAR.startVideo(true)
    }
  })
}

// Call the layout method any time the size of the layout container changes
var resizeTimeout;
window.onresize = function() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(function () {
    layout.layout();
  }, 20);
};
