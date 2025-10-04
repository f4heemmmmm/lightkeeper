import cors from 'cors';
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/database';
import taskRoutes from './src/routes/taskRoutes';
import authRoutes from './src/routes/authRoutes';
import userRoutes from "./src/routes/userRoutes";
import commentRoutes from "./src/routes/commentRoutes";
import meetingRoutes from "./src/routes/meetingRoutes";
import notetakerRoutes from "./src/routes/notetakerRoutes";
import emailRoutes from "./src/routes/emailRoutes";
import { startEmailScheduler } from './src/services/emailSchedulerService';

dotenv.config();

const app = express();

// Connect to database
connectDB().then(() => {
    // Start email scheduler after database connection is established
    console.log(' Database connected, starting email scheduler...');
    startEmailScheduler();
}).catch(err => {
    console.error(' Database connection failed, email scheduler not started');
});

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the API', status: 'running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notetaker', notetakerRoutes);
app.use('/api/emails', emailRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API endpoints available at:`);
    console.log(`  - Auth: http://localhost:${PORT}/api/auth`);
    console.log(`  - Tasks: http://localhost:${PORT}/api/tasks`);
    console.log(`  - Comments: http://localhost:${PORT}/api/comments`);
    console.log(`  - Meetings: http://localhost:${PORT}/api/meetings`);
    console.log(`  - Emails: http://localhost:${PORT}/api/emails`);
});