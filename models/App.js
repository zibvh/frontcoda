const mongoose = require('mongoose');

const UpdateSchema = new mongoose.Schema({
  version: { type: String, required: true },
  whatsNew: { type: String, required: true },
  screenshots: [String], // base64
  date: { type: Date, default: Date.now }
});

const FeatureSchema = new mongoose.Schema({
  icon: String,
  title: String,
  desc: String
});

const AppSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  tagline:     { type: String, default: '' },
  about:       { type: String, default: '' },
  category:    { type: String, default: '' },
  platform:    { type: String, default: '' },
  version:     { type: String, default: '1.0.0' },
  size:        { type: String, default: '' },
  downloadUrl: { type: String, default: '#' },
  rating:      { type: Number, default: 0 },
  downloads:   { type: String, default: '0' },
  icon:        { type: String, default: '' }, // base64
  banner:      { type: String, default: '' }, // base64
  screenshots: [String],                       // base64[]
  features:    [FeatureSchema],
  updates:     [UpdateSchema],
  order:       { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now }
});

AppSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('App', AppSchema);
