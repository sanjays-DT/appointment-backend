require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors"); 

const app = express();

// Middleware
app.use(express.json());

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:2000"], 
  credentials: true, 
}));

// Connect to DB
connectDB();

// Base route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Load all routes through routes/index.js
app.use("/api", require("./routes/index"));

app.listen(5000, () =>
   console.log("Server running on 5000")
);
