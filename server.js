require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { Client, twiml } = require('twilio');
const NumberMap = require('./models/NumberMap');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI);

const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Buy and assign Twilio number to user
app.post('/buy-and-assign', async (req, res) => {
  const { userNumber } = req.body;
  try {
    const available = await client.availablePhoneNumbers(process.env.TWILIO_COUNTRY)
      .local.list({ limit: 1 });

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      voiceUrl: process.env.TWILIO_FORWARD_URL,
      voiceMethod: 'POST'
    });

    const mapping = new NumberMap({
      twilioSid: purchased.sid,
      twilioNumber: purchased.phoneNumber,
      userNumber
    });

    await mapping.save();

    res.json({ success: true, data: mapping });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all mappings
app.get('/mappings', async (req, res) => {
  const list = await NumberMap.find();
  res.json(list);
});

// Update user number mapping
app.put('/mapping/:id', async (req, res) => {
  const { userNumber } = req.body;
  const mapping = await NumberMap.findByIdAndUpdate(req.params.id, { userNumber }, { new: true });
  res.json(mapping);
});

// Delete mapping and release number
app.delete('/mapping/:id', async (req, res) => {
  const mapping = await NumberMap.findById(req.params.id);
  if (!mapping) return res.status(404).send('Mapping not found');

  await client.incomingPhoneNumbers(mapping.twilioSid).remove();
  await NumberMap.deleteOne({ _id: req.params.id });

  res.send('Mapping deleted and number released');
});

// Incoming call webhook — forwards call
app.post('/forward', async (req, res) => {
  const response = new twiml.VoiceResponse();
  const calledNumber = req.body.To || req.body.Called;

  const mapping = await NumberMap.findOne({ twilioNumber: calledNumber });

  if (!mapping) {
    response.say('This number is not assigned.');
  } else {
    response.dial(mapping.userNumber);
  }

  res.type('text/xml');
  res.send(response.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));