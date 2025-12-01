require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

const app = express();
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api", require("./routes/index"));

app.listen(5000, () => console.log("Server running on 5000"));
