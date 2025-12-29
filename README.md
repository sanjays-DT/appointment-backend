**Appointment Booking System – Backend**

Backend service for an appointment booking platform supporting user, provider, and admin workflows. Built with Node.js, Express, and MongoDB, providing secure authentication, appointment management, analytics, and notifications.

**Features**

=>User authentication & authorization (JWT)

=>Role-based access (User / Provider / Admin)

=>Appointment booking, approval, rejection, rescheduling

=>Provider & category management

=>Admin analytics (usage & bookings)

=>Notification system

=>RESTful API architecture

**Tech Stack**

=> Node.js

=> Express.js

=> MongoDB & Mongoose

=> JWT Authentication

=> bcrypt

=> CORS

=> dotenv

**Authentication**

=> JWT-based authentication

=> Token passed via Authorization header

=> Protected routes using middleware

**Analytics**

=> Provider utilization

=> Category usage

=> Weekly appointment statistics

=> Implemented using MongoDB aggregation pipeline

**Notifications**

=> Triggered on appointment events

=> Stored and retrieved from database

=> Supports read/unread status

**Environment Variables**

=> Create a .env file:

PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret

**Running the Project**

npm install

npm start

Server runs on: http://localhost:5000

**Deployment**

Backend: https://appointment-backend-qntn.onrender.com

User UI: https://appointment-frontend-6jd3.vercel.app

Admin UI: https://appointment-frontend-admin-vn4f.vercel.app
