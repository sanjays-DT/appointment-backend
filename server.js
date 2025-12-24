require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:2000",
    "https://appointment-frontend-6jd3.vercel.app",
    "https://appointment-frontend-admin-7sah.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options(/.*/, cors());

app.use(express.json());
connectDB();

/* ---------- Routes ---------- */
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api", require("./routes/index"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
