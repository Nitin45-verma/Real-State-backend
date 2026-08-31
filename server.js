const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) { }
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Configure CORS for allowed origins including live Vercel frontend
const allowedOrigins = [
  'http://13.51.201.78:5000',
  'http://13.51.201.78',
  'http://51.20.2.234:5000',
  'http://51.20.2.234',
  'https://nitin-real-state.vercel.app',
  'http://13.60.227.235:5000',
  'http://13.60.227.235',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(cleanOrigin) || /\.vercel\.app$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Ensure uploads directory exists for file uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// Health check and Test GET endpoints
app.get('/', (req, res) => {
  res.json({ status: 'Online', message: 'Nitin Real Estate API Server is Running' });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'GET API is working successfully!',
    timestamp: new Date().toISOString(),
    server: 'AWS EC2 - Nitin Real Estate'
  });
});

// Routes
const propertyRoutes = require('./routes/properties');
const contactRoutes = require('./routes/contacts');
const authRoutes = require('./routes/auth');
const inquiryRoutes = require('./routes/inquiries');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const leadRoutes = require('./routes/leads');

app.use('/api/properties', propertyRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/leads', leadRoutes);

const User = require('./models/User');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nitin-real-estate';

const ensureAdminUser = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'nikn63641@gmail.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'nitin123';

    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      admin.role = 'Admin';
      admin.isVerified = true;
      admin.password = adminPassword; // Triggers pre('save') bcrypt hashing in User model
      await admin.save();
      console.log(`✅ Admin account updated/verified: ${adminEmail}`);
    } else {
      await User.create({
        name: 'Nitin Admin',
        email: adminEmail,
        password: adminPassword, // Triggers pre('save') bcrypt hashing in User model
        role: 'Admin',
        isVerified: true
      });
      console.log(`✅ Admin account created: ${adminEmail}`);
    }
  } catch (err) {
    console.error('❌ Failed to initialize admin user:', err.message);
  }
};

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await ensureAdminUser();

    // ✅ FIX: app.listen ko `const server` variable me store kiya
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use by another process. Please terminate the conflicting process or change PORT in .env.`);
      } else {
        console.error('Server listen error:', err);
      }
    });
  })
  .catch((err) => console.error('MongoDB connection error:', err));


