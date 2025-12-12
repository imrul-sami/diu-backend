const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected...'))
.catch(err => console.error('MongoDB Connection Error:', err));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const User = require('./models/User.js');
let busLocations = {};

// --- Middleware ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// --- API Routes ---

// 1. Register User
app.post('/api/auth/register', async (req, res) => {
    const { name, email, universityID, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) { return res.status(400).json({ message: 'User already exists' }); }
        user = await User.findOne({ universityID });
        if (user) { return res.status(400).json({ message: 'University ID already registered' }); }
        
        user = new User({ name, email, universityID, password, role: 'user' });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// 2. Register Driver
app.post('/api/auth/register-driver', async (req, res) => {
    const { name, email, universityID, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) { return res.status(400).json({ message: 'Driver already exists' }); }
        user = await User.findOne({ universityID });
        if (user) { return res.status(400).json({ message: 'University ID already registered' }); }

        user = new User({ name, email, universityID, password, role: 'driver' });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        res.status(201).json({ message: 'Driver registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// 3. Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) { return res.status(400).json({ message: 'Invalid credentials' }); }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) { return res.status(400).json({ message: 'Invalid credentials' }); }

        const payload = { user: { id: user.id, name: user.name, role: user.role } };
       //'365d' (১ বছর পর্যন্ত লগইন থাকবে)
jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '365d' }, (err, token) => {
    if (err) throw err;
    res.json({
        token,
        user: {
            name: user.name,
            role: user.role
        }
    });
});
    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// 4. Update Location (Driver Only)
app.post('/api/location/update', authMiddleware, async (req, res) => {
    if(req.user.role !== 'driver') {
         return res.status(403).json({ message: 'Only drivers can update location' });
    }
    const { busId, lat, lng } = req.body;
    const userId = req.user.id;
    
    const newLocation = { lat, lng, driverId: userId, timestamp: new Date() };
    busLocations[busId] = newLocation;
    io.emit('locationUpdate', { busId, ...newLocation });
    res.json({ message: 'Location updated' });
});

//  5. Admin: Get All Users
app.get('/api/admin/users', authMiddleware, async (req, res) => {
    if(req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access denied' });
    }
    try {
        const users = await User.find().select('-password'); // পাসওয়ার্ড ছাড়া সব দেখাবে
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

//  6. Admin: Delete User
app.delete('/api/admin/delete/:id', authMiddleware, async (req, res) => {
    if(req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access denied' });
    }
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Socket.IO ---
io.on('connection', (socket) => {
    socket.on('requestAllLocations', () => socket.emit('allLocations', busLocations));
});

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


