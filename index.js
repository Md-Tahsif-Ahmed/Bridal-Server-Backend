const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');
const nodemailer = require('nodemailer');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const WEDDB = "Bridal";

// MongoDB URI
const uri = "mongodb+srv://tahsifdreamdriver:gQPQQvx4ZkKxCGke@cluster0.n7jc7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON bodies

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // Replace with your Ethereal email username
    pass: process.env.EMAIL_PASS, // Replace with your Ethereal email password
  },
});

// Function to send an email
async function sendConfirmationEmail(to, appointmentDetails) {
  const mailOptions = {
    from: '"Your Service" tahsif.dreamdriver@gmail.com', // Replace with your email
    to: `${to}, tahsif.cse@gmail.com`, // Send email to both user and fixed address
    subject: 'Appointment Confirmation',
    text: `Hello ${appointmentDetails.name},\n\nYour appointment is confirmed for ${appointmentDetails.datetime}. We look forward to seeing you.\n\nBest regards,\nYour Service`,
    html: `<p>Hello ${appointmentDetails.name},</p><p>Your appointment is confirmed for ${appointmentDetails.datetime}. We look forward to seeing you.</p><p>Best regards,<br>Your Service</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log("Connected successfully to MongoDB!");

    const appCollection = client.db(WEDDB).collection("appointment");
    const offDaysCollection = client.db(WEDDB).collection("offdays");

    // Endpoint to add an appointment
    app.post('/addapp', async (req, res) => {
      try {
        const newApp = req.body;
        const existingAppointment = await appCollection.findOne({ datetime: newApp.datetime });

        if (existingAppointment) {
          return res.status(400).json({ message: 'Selected time slot is already booked.' });
        }

        const isOffDay = await offDaysCollection.findOne({ date: newApp.datetime.split('T')[0] });
        if (isOffDay) {
          return res.status(400).json({ message: 'Selected day is not available for appointments.' });
        }

        const result = await appCollection.insertOne(newApp);

        // Send confirmation email
        await sendConfirmationEmail(newApp.email, newApp);

        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add appointment", error });
      }
    });

    // Endpoint to check available time slots for a given date
    app.get('/check-available-time', async (req, res) => {
      try {
        const { date } = req.query;
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(startDate.getDate() + 1); // Check availability for the whole day

        const appointments = await appCollection.find({
          datetime: {
            $gte: startDate.toISOString(),
            $lt: endDate.toISOString()
          }
        }).toArray();

        const bookedSlots = appointments.map(app => {
          const time = new Date(app.datetime).toTimeString().split(' ')[0].slice(0, 5);
          return time;
        });

        // Define possible time slots
        const possibleSlots = ['11:30', '13:00', '15:00', '16:00'];
        const availableSlots = possibleSlots.filter(slot => !bookedSlots.includes(slot));

        res.json({ slots: availableSlots });
      } catch (error) {
        res.status(500).json({ message: "Failed to check available slots", error });
      }
    });

    // Endpoint to check if a time slot is available
    app.get('/check-slot', async (req, res) => {
      try {
        const { datetime } = req.query;

        const existingAppointment = await appCollection.findOne({ datetime });
        if (existingAppointment) {
          return res.json({ available: false });
        }

        const isOffDay = await offDaysCollection.findOne({ date: datetime.split('T')[0] });
        if (isOffDay) {
          return res.json({ available: false });
        }

        res.json({ available: true });
      } catch (error) {
        res.status(500).json({ message: "Failed to check slot availability", error });
      }
    });

    // Endpoint to mark days as off for appointments
    app.post('/offdays', async (req, res) => {
      try {
        const { date } = req.body;
        const result = await offDaysCollection.insertOne({ date });

        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to add off day", error });
      }
    });

    // Start the server
    app.listen(port, () => {
      console.log(`App listening on port ${port}`);
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});
