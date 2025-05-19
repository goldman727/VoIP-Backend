const mongoose = require('mongoose');

const numberMapSchema = new mongoose.Schema({
  twilioSid: String,
  twilioNumber: String,
  userNumber: String,
});

module.exports = mongoose.model('NumberMap', numberMapSchema);