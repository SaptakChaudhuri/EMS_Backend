const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai'); // Use require instead of import

// Clearing database
const clearDatabase = async () => {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
};

// DB INITIALIZATION
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        clearDatabase();
        console.log("Connected to MongoDB");
    })
    .catch(err => console.error('Could not connect to MongoDB:', err));

const listSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    }
});

const StudentList = mongoose.model("StudentList", listSchema);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_AI_API_KEY);

// ADMIN CONTROLS
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        clearDatabase();
        return res.status(200).send("Admin logged in successfully");
    } else {
        return res.status(500).send("Login failed! Please check your credentials");
    }
});

app.post('/generate-questions', async (req, res) => {
    const { topic, numQuestions, timing } = req.body;

    try {
        // Choose a model that's appropriate for your use case.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Generate ${numQuestions} MCQ questions on the topic "${topic}". Format: [{"question": "Question?", "options": ["Option1", "Option2", "Option3", "Option4"], "correctAnswer": "OptionX"}]`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = await response.text();
        
        // Clean the response text if needed (e.g., remove code fences)
        const cleanedText = text.replace(/```json|```/g, '').trim();

        // Parse the cleaned content
        const questions = JSON.parse(cleanedText);

        res.json({ questions, timing });
    } catch (error) {
        console.error('Error generating questions: ', error);
        res.status(500).send('Error generating questions');
    }
});


app.post('/add-students', async (req, res) => {
    const { topic, email, password } = req.body;

    try {
        const student = new StudentList({ topic, email, password });
        await student.save();
        res.status(201).send('Student added successfully');
    } catch (err) {
        res.status(500).send("Error adding student");
    }
});

app.get('/students', async (req, res) => {
    try {
        const students = await StudentList.find();
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).send('Error fetching students');
    }
});

// STUDENT CONTROLS

app.post('/students-login', async (req, res) => {
    const { topic, email, password } = req.body;

    try {
        // Find the user by email and topic
        const user = await StudentList.findOne({ email, topic });

        if (!user) {
            return res.status(400).send("User not found or topic not assigned");
        }

        if (user.password !== password) {
            return res.status(400).send("Invalid password");
        }

        res.status(200).send("Login successful");
    } catch (err) {
        res.status(500).send("Error logging in");
    }
});

const PORT = process.env.PORT||5000;
app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
