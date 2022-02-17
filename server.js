import dotenv from 'dotenv'
dotenv.config();

const PROJECT_API_KEY = process.env.PROJECT_API_KEY;
const PROJECT_API_SECRET = process.env.PROJECT_API_SECRET;
const DEEPAR_LICENSE_KEY = process.env.DEEPAR_LICENSE_KEY;

import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import logger from 'morgan'

import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url));

var app = express();

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(join(__dirname, 'public')));
app.listen(process.env.PORT);

// ------------------------------------------------------------------------

import Util from 'util'

import { Low, JSONFile } from 'lowdb'
const adapter = new JSONFile(join(__dirname, 'db.json'));
const db = new Low(adapter);

import OpenTok from 'opentok'
const opentok = new OpenTok(PROJECT_API_KEY, PROJECT_API_SECRET);

app.get('/', (req, res, next) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.post('/init', async (req, res, next) => {
  try {
    let { uid, jwtToken } = req.body;

    if (!jwtToken && !uid) {
      throw({ code: 401, message: "Unauthorized - no credentials given" });
    }

    // If they are using jwtToken, they are the host - we can create the room if it doesn't exist
    // Otherwise, if they are a participant, we will prevent them from creating the room
    let role = jwtToken ? "host" : "participant";
    let roomId;

    if (jwtToken) {
      let jwtPayload = await parseJwt(jwtToken);
      // console.log("jwtPayload : ", JSON.stringify(jwtPayload));

      // Validate token expiry
      if (new Date() >= new Date(jwtPayload.exp * 1000)) {
        throw({ code: 401, message: "Unauthorized - token expired" });
      }

      roomId = jwtPayload.userid;
    } else {
      roomId = uid;
    }
    let roomLink = `https://${req.get('host')}?uid=${roomId}`;

    let result = await findRoom(roomId, role);
    if (result.code) {
      throw(result);
    }

    let room = result;
    if (!room.sessionId) {
      const generateSessionFunction = Util.promisify(generateSession);
      let sessionId = await generateSessionFunction();
      room = await saveSessionId(roomId, sessionId);
    }

    let token = await generateToken(room.sessionId);
    console.log(`Token created`);

    res.json({
      apiKey: PROJECT_API_KEY,
      deepArLicenseKey: DEEPAR_LICENSE_KEY,
      sessionId: room.sessionId,
      token, roomLink
    });

  } catch (error) {
    console.error(error);
    if (!error.code) {
      error.code = 500;
    }
    res.status(error.code).send(error.message);
  }
});

// ------------------------------------------------------------------------

async function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
};

async function findRoom(roomId, role) {
  await db.read();

  if (!db.data.rooms.hasOwnProperty(roomId)){
    if (role === "participant") {
      return { code: 404, message: "Room doesn't exist" };
    }

    let ts = new Date();
    let hours = 24;
    db.data.rooms[roomId] = {
      sessionId: "",
      createdAt: ts.toISOString()
    };
    await db.write();
  }

  return db.data.rooms[roomId];
}

function generateSession(callback) {
  opentok.createSession((err, session) => {
    if (err) {
      console.error(err);
      return callback(err);
    }

    console.log(`Session created`);
    callback(null, session.sessionId);
  });
}

async function saveSessionId(roomId, sessionId) {
  await db.read();
  db.data.rooms[roomId].sessionId = sessionId;
  await db.write();

  return db.data.rooms[roomId];
}

async function generateToken(sessionId) {
  return opentok.generateToken(sessionId);
}
