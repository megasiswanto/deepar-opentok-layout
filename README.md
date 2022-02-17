This app launches a simple multi-party video conference, where each participants can switch between various filters offered by DeepAR.

## 📚 Dependencies
- [Vonage Video API](https://www.vonage.com/communications-apis/video/)
- [DeepAR Web SDK (v3.4.2)](https://developer.deepar.ai/downloads)
- [opentok-layout-js](https://github.com/aullman/opentok-layout-js)

## 🛠 Setup
1. Create a [Tokbox account](https://tokbox.com/account/) and create a new project with the type "Vonage Video API".
2. Create a [DeepAR account](https://developer.deepar.ai/login), create a new project, and generate the license key.
3. Make sure `.env` file exists on root folder (format is inside `.env.example`). Content of the file should filled in accordingly.

## ▶️ Run Project
- Execute: `npm i`
- Execute: `node server.js`
- OpenTok requires https, so for testing purposes, setup a [ngrok tunnel](https://ngrok.com/). Open the URL accordingly.
