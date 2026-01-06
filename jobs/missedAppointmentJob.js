const cron = require("node-cron");
const { markMissedAppointments } = require("../controllers/appointmentController.js");

cron.schedule("*/5 * * * *", async () => {
  try {
    await markMissedAppointments();
  } catch (err) {
    console.error("Missed appointment job failed", err);
  }
});
