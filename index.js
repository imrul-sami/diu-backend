const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins
        methods: ['GET', 'POST']
    }
});

// Database connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected...'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Middlewares
app.use(cors());
app.use(express.json());

// Models
const User = require('./models/User.js');

// Store bus locations in memory
let busLocations = {};

// --- Auth Middleware ---
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

// 1. User Registration
app.post('/api/auth/register', async (req, res) => {
    const { name, email, universityID, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        user = await User.findOne({ universityID });
        if (user) {
            return res.status(400).json({ message: 'University ID already registered' });
        }
        user = new User({ name, email, universityID, password, role: 'user' });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Register User Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// 2. Driver Registration
app.post('/api/auth/register-driver', async (req, res) => {
    const { name, email, universityID, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'Driver already exists' });
        }
        user = await User.findOne({ universityID });
        if (user) {
            return res.status(400).json({ message: 'University ID already registered' });
        }
        user = new User({ name, email, universityID, password, role: 'driver' });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        res.status(201).json({ message: 'Driver registered successfully' });
    } catch (err) {
        console.error('Register Driver Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// 3. Login (Both User and Driver)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const payload = {
            user: {
                id: user.id,
                name: user.name,
                role: user.role
            }
        };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
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
        console.error('Login Error:', err.message);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// 4. Update Driver Location (Secured)
app.post('/api/location/update', authMiddleware, async (req, res) => {
    if(req.user.role !== 'driver') {
         return res.status(403).json({ message: 'Only drivers can update location' });
    }
    const { busId, lat, lng } = req.body;
    const userId = req.user.id;
    
    if (!busId || lat == null || lng == null) {
        return res.status(400).json({ message: 'Bus ID, lat, and lng are required' });
    }

    const newLocation = {
        lat,
        lng,
        driverId: userId,
        timestamp: new Date()
    };
    busLocations[busId] = newLocation;

    io.emit('locationUpdate', { busId, ...newLocation });
    
    res.json({ message: 'Location updated successfully' });
});

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('requestAllLocations', () => {
        socket.emit('allLocations', busLocations);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// --- Serve Frontend ---

// Start Server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
