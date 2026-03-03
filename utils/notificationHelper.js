// utils/notificationHelper.js
const moment = require('moment-timezone');

// Default timezone
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Format date for user notification
 */
async function formatForUser(date, userId, timezone = DEFAULT_TIMEZONE) {
  try {
    // Ensure date is a valid Date object
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatForUser:', date);
      return 'Invalid date';
    }

    // Format using moment-timezone
    return moment(dateObj)
      .tz(timezone)
      .format('dddd, MMMM Do YYYY [at] h:mm A'); // Example: "Thursday, March 5th 2026 at 10:30 AM"
      
  } catch (error) {
    console.error('Error in formatForUser:', error);
    return new Date(date).toLocaleString(); // Fallback
  }
}

/**
 * Format date for provider notification
 */
async function formatForProvider(date, providerId, timezone = DEFAULT_TIMEZONE) {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatForProvider:', date);
      return 'Invalid date';
    }

    return moment(dateObj)
      .tz(timezone)
      .format('dddd, MMMM Do YYYY [at] h:mm A');
      
  } catch (error) {
    console.error('Error in formatForProvider:', error);
    return new Date(date).toLocaleString(); // Fallback
  }
}

module.exports = {
  formatForUser,
  formatForProvider,
  DEFAULT_TIMEZONE
};