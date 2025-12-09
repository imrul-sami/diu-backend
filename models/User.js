const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    //  এখানে 'universityID' (বড় হাতের ID) ব্যবহার করা হয়েছে যা ফ্রন্টএন্ডের সাথে মিলবে
    universityID: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['user', 'driver', 'admin'], // admin রোল যোগ করা হয়েছে
        default: 'user'
    },
    password: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('UserV2', UserSchema);
