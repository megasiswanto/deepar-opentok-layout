// Essential variables
var apiKey, sessionId, token, deepArLicenseKey, roomLink;
var publisher;
var videoOn = "ON";
var audioOn = "ON";

const queryParams = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});
var {
  uid,
  ref: jwtToken
} = queryParams;

// Create canvas on which DeepAR will render
var deepARCanvas = document.createElement('canvas');
var canvasContext = deepARCanvas.getContext('webgl');
var mediaStream = deepARCanvas.captureStream(25);
var videoTracks = mediaStream.getVideoTracks();
var deepAR;

// Initialize the layout container and get a reference to the layout method
var layoutContainer = document.getElementById("layoutContainer");
var layout = initLayoutContainer(layoutContainer);
layout.layout();

// --------------------

axios.post("/init", { uid, jwtToken })
.then(result => {
  console.log("/init | ", result);
  if (result.status === 200) {
    apiKey = result.data ? result.data.apiKey : "";
    sessionId = result.data ? result.data.sessionId : "";
    token = result.data ? result.data.token : "";
    deepArLicenseKey = result.data ? result.data.deepArLicenseKey : "";
    roomLink = result.data ? result.data.roomLink : "";

    // start DeepAR
    startDeepAR(deepARCanvas, deepArLicenseKey);

    // start video call
    initializeSession(videoTracks[0]);
  } else {
    handleError(result);
  }
})
.catch(handleError);

// --------------------

var changePublishAudioButton = document.getElementById('change-publish-audio');
changePublishAudioButton.onclick = function() {
  let prevAudioOn = audioOn;
  audioOn = audioOn === "ON" ? "OFF" : "ON";
  publisher.publishAudio(audioOn === "ON" ? true : false);

  var element1 = document.getElementById(`audio-${audioOn.toLowerCase()}`);
  element1.classList.remove("hide");
  var element2 = document.getElementById(`audio-${prevAudioOn.toLowerCase()}`);
  element2.classList.add("hide");
}

var changePublishVideoButton = document.getElementById('change-publish-video');
changePublishVideoButton.onclick = function() {
  let prevVideoOn = videoOn;
  videoOn = videoOn === "ON" ? "OFF" : "ON";
  publisher.publishVideo(videoOn === "ON" ? true : false);

  var element1 = document.getElementById(`video-${videoOn.toLowerCase()}`);
  element1.classList.remove("hide");
  var element2 = document.getElementById(`video-${prevVideoOn.toLowerCase()}`);
  element2.classList.add("hide");
}

var shareRoomButton = document.getElementById('share-room-button');
shareRoomButton.onclick = function() {
  navigator.clipboard.writeText(roomLink);

  var element = document.getElementById(`notification`);
  element.classList.remove("hide");
  setTimeout(() => {
    element.classList.add("hide");
  }, 5000);
}

// --------------------

// Handling all of our errors here by alerting them
function handleError(error) {
  console.log('handle error', error);
  if (error) {
    alert(error.message);
  }
}

// Initialize OpenTok session, publish video/audio
function initializeSession(videoSource) {
  console.log("initializeSession");
  var session = OT.initSession(apiKey, sessionId);

  publisher = OT.initPublisher('publisherContainer', {
    insertMode: 'append',
    width: '100%',
    height: '100%',
    videoSource: videoSource,
    style: {
      buttonDisplayMode: 'off'
    }
  }, handleError);

  publisher.publishVideo(videoOn);
  publisher.publishAudio(audioOn);

  session.connect(token, function(error) {
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

// Start DeepAR
function startDeepAR(canvas, deepArLicenseKey) {
  console.log("startDeepAR");

  deepAR = DeepAR({
    canvasWidth: 640,
    canvasHeight: 480,
    licenseKey: deepArLicenseKey,
    libPath: './../deepar',
    segmentationInfoZip: 'segmentation.zip',
    canvas: canvas,
    numberOfFaces: 1,
    onInitialize: function() {
      deepAR.startVideo(true); // start video immediately after the initalization, mirror = true

      deepAR.switchEffect(0, 'slot', './effects/aviators', function() { });
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
