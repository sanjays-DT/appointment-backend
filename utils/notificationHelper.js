// utils/notificationHelper.js
const moment = require('moment-timezone');

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Format date for user notification
 * @param {Date|string} date - The UTC date from database
 * @param {string} userId - User ID (not used but kept for compatibility)
 * @param {string} timezone - User's timezone
 */
async function formatForUser(date, userId, timezone = DEFAULT_TIMEZONE) {
  try {
    // Ensure date is a Date object
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date:', date);
      return 'Invalid date';
    }

    // CRITICAL: Use moment.utc() to parse the UTC date, then convert to timezone
    const formatted = moment.utc(dateObj)
      .tz(timezone)
      .format('dddd, MMMM Do YYYY [at] h:mm A');
    
    console.log(`formatForUser: ${dateObj.toISOString()} -> ${timezone} -> ${formatted}`);
    
    return formatted;
    
  } catch (error) {
    console.error('Error in formatForUser:', error);
    return new Date(date).toLocaleString();
  }
}

/**
 * Format date for provider notification
 */
async function formatForProvider(date, providerId, timezone = DEFAULT_TIMEZONE) {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date:', date);
      return 'Invalid date';
    }

    const formatted = moment.utc(dateObj)
      .tz(timezone)
      .format('dddd, MMMM Do YYYY [at] h:mm A');
    
    console.log(`formatForProvider: ${dateObj.toISOString()} -> ${timezone} -> ${formatted}`);
    
    return formatted;
    
  } catch (error) {
    console.error('Error in formatForProvider:', error);
    return new Date(date).toLocaleString();
  }
}

module.exports = {
  formatForUser,
  formatForProvider,
  DEFAULT_TIMEZONE
};