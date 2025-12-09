// models/Location.js
const mongoose = require('mongoose');

// আমরা ডাটাবেসে কী কী তথ্য রাখব তার একটি ব্লুপ্রিন্ট বা Schema
const LocationSchema = new mongoose.Schema({
    busId: {
        type: String,
        required: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now // ডেটা সেভ করার সময় স্বয়ংক্রিয়ভাবে বর্তমান সময় সেভ হবে
    }
});

// এই Schema-টিকে একটি Model হিসেবে এক্সপোর্ট করা হচ্ছে
// আমরা সার্ভারের অন্য ফাইল থেকে 'Location' নামে এটিকে ব্যবহার করব
const Location = mongoose.model('Location', LocationSchema);

module.exports = Location;