// require("dotenv").config();
import dotenv from 'dotenv'
dotenv.config();

const PROJECT_API_KEY = process.env.PROJECT_API_KEY;
const PROJECT_API_SECRET = process.env.PROJECT_API_SECRET;
const DEEPAR_LICENSE_KEY = process.env.DEEPAR_LICENSE_KEY;

// var express = require('express');
// var cors = require('cors');
// var path = require('path');
// var cookieParser = require('cookie-parser');
// var logger = require('morgan');

import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
// import cookieParser from 'cookie-parse'
import logger from 'morgan'

import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url));

var app = express();

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
app.use(express.static(join(__dirname, 'public')));
app.listen(process.env.PORT);

app.get('/', (req, res, next) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// ------------------------------------------------------------------------

// const Util = require('util');
import Util from 'util'

import { Low, JSONFile } from 'lowdb'
// import { fileURLToPath } from 'url'
const adapter = new JSONFile(join(__dirname, 'db.json'));
const db = new Low(adapter);

// const OpenTok = require("opentok");
import OpenTok from 'opentok'
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

  await db.read();
  db.data ||= { rooms: [] };
  db.data.rooms.push({ sessionId: sessionId });
  await db.write()

  token = await generateToken(sessionId);
  console.log(`Token created ${token}`);

  res.json({
    apiKey: PROJECT_API_KEY,
    deepArLicenseKey: DEEPAR_LICENSE_KEY,
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
