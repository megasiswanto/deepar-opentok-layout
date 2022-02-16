require("dotenv").config();

const PROJECT_API_KEY = process.env.PROJECT_API_KEY;
const PROJECT_API_SECRET = process.env.PROJECT_API_SECRET;

var express = require('express');
var cors = require('cors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var app = express();

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.listen(process.env.PORT);

app.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname+'/index.html'));
});

// ------------------------------------------------------------------------

const Util = require('util');
const OpenTok = require("opentok");
const opentok = new OpenTok(PROJECT_API_KEY, PROJECT_API_SECRET);

let theSession = {
  sessionId: ""
};

app.post('/init', async (req, res, next) => {
  const generateSessionFunction = Util.promisify(generateSession);
  let token = "", sessionId = "";

  if (theSession.sessionId !== "") {
    sessionId = theSession.sessionId;
    console.log(`Session found ${sessionId}`);
  } else {
    sessionId = await generateSessionFunction();
  }
  token = await generateToken(sessionId);
  console.log(`Token created ${token}`);

  res.json({
    apiKey: PROJECT_API_KEY,
    sessionId, token
  });
});

app.post('/housekeeping', async (req, res, next) => {
  theSession = {
    sessionId: ""
  };

  res.json({ theSession });
});

function generateSession(callback) {
  opentok.createSession((err, session) => {
    if (err) {
      console.error(err);
      return callback(err);
    }

    console.log(`Session created ${session.sessionId}`);
    // save the sessionId
    theSession.sessionId = session.sessionId;

    callback(null, theSession.sessionId);
  });
}

async function generateToken(sessionId) {
  return opentok.generateToken(sessionId);
}
