const mongoose = require('mongoose');

const connectDB = async (mongoUri) => {
  try {
    const uri = mongoUri || process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not provided');
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
