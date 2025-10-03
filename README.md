# Backend API Documentation

A Node.js/Express backend API for task management, meeting notes analysis, and automated notetaker functionality.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control (Organisation/Member)
- **Task Management**: Create, assign, and track tasks with privacy controls
- **Meeting Notes**: Upload and analyze meeting transcripts using AI
- **Automated Notetaker**: Schedule a bot to join meetings and generate transcripts
- **Comments**: Collaborate on tasks with threaded comments
- **AI-Powered Analysis**: Automatic extraction of summaries and action items from meeting notes

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with bcryptjs
- **AI Services**: OpenAI GPT-4
- **Meeting Integration**: Nylas API for notetaker functionality

## Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB instance
- OpenAI API key
- Nylas API key and Grant ID
- Cloudflared (for webhook tunneling)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```properties
# Server Configuration
PORT=4000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=30d

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Nylas API
NYLAS_API_KEY=your_nylas_api_key_here

# Nylas Grant ID 
NYLAS_GRANT_ID=your_nylas_grant_id_here

# Webhook URL for Nylas
WEBHOOK_URL=http://localhost:4000/api/notetaker/webhook
```

**Important**: Replace the placeholder values with your actual credentials. Never commit the `.env` file to version control.

## Running the Application

### Development Mode

Start the development server with hot reload:
```bash
npm run dev
```

The server will start on `http://localhost:4000`

### Production Mode

Build and run the production version:
```bash
npm run build
npm start
```

## Setting Up the Notetaker Feature

The notetaker feature requires exposing your local server to the internet for Nylas webhooks.

### Prerequisites
1. Make sure the server is running in development mode:
```bash
npm run dev
```

2. Install Cloudflared if you haven't already:
- **macOS**: `brew install cloudflare/cloudflare/cloudflared`
- **Windows**: Download from [Cloudflare's website](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)
- **Linux**: `wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb`

### Expose Your Local Server

Run the following command in a separate terminal:
```bash
cloudflared tunnel --url http://localhost:4000
```

This will output a public URL (e.g., `https://random-name.trycloudflare.com`). 

**Update your Nylas webhook configuration** with:
```
https://your-cloudflare-url.trycloudflare.com/api/notetaker/webhook
```

Keep the cloudflared tunnel running while testing the notetaker feature.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Users
- `GET /api/users/members` - Get all members (protected)

### Tasks
- `GET /api/tasks` - Get all tasks (protected, filtered by role)
- `GET /api/tasks/unassigned` - Get unassigned tasks (protected)
- `GET /api/tasks/:id` - Get single task (protected)
- `POST /api/tasks` - Create new task (protected)
- `PUT /api/tasks/:id` - Update task (protected)
- `PUT /api/tasks/:id/assign` - Assign task (protected)
- `PUT /api/tasks/:id/unassign` - Unassign task (protected)
- `DELETE /api/tasks/:id` - Delete task (protected)

### Comments
- `GET /api/comments/task/:taskId` - Get task comments (protected)
- `POST /api/comments/task/:taskId` - Create comment (protected)
- `PUT /api/comments/:commentId` - Update comment (protected)
- `DELETE /api/comments/:commentId` - Delete comment (protected)

### Meetings
- `GET /api/meetings` - Get all meetings (protected)
- `GET /api/meetings/:id` - Get single meeting (protected)
- `POST /api/meetings` - Create meeting (upload notes) (protected)
- `PUT /api/meetings/:id` - Update meeting (protected)
- `DELETE /api/meetings/:id` - Delete meeting (protected)

### Notetaker
- `POST /api/notetaker/schedule` - Schedule notetaker for meeting (protected)
- `GET /api/notetaker/sessions` - Get all notetaker sessions (protected)
- `GET /api/notetaker/sessions/:id` - Get single session (protected)
- `DELETE /api/notetaker/cancel/:id` - Cancel notetaker session (protected)
- `POST /api/notetaker/webhook` - Webhook endpoint for Nylas (public)

## Project Structure

```
backend/
├── src/
│   ├── controllers/        # Request handlers
│   │   ├── authController.ts
│   │   ├── taskController.ts
│   │   ├── userController.ts
│   │   ├── commentController.ts
│   │   ├── meetingController.ts
│   │   └── notetakerController.ts
│   ├── middleware/         # Custom middleware
│   │   └── auth.ts
│   ├── models/            # Mongoose models
│   │   ├── User.ts
│   │   ├── Task.ts
│   │   ├── Comment.ts
│   │   ├── Meeting.ts
│   │   └── NotetakerSession.ts
│   ├── routes/            # API routes
│   │   ├── authRoutes.ts
│   │   ├── taskRoutes.ts
│   │   ├── userRoutes.ts
│   │   ├── commentRoutes.ts
│   │   ├── meetingRoutes.ts
│   │   └── notetakerRoutes.ts
│   └── services/          # External service integrations
│       ├── openaiService.ts
│       └── nylasService.ts
├── config/
│   └── database.ts        # MongoDB connection
├── index.ts              # Application entry point
├── .env                  # Environment variables (not in git)
├── package.json
└── tsconfig.json
```

## User Roles

### Organisation
- Can create non-private tasks
- Can assign tasks to any member
- Can view all non-private tasks
- Can delete non-private tasks
- Can delete any comments

### Member
- Can only create private tasks
- Can self-assign unassigned tasks
- Can view tasks assigned to them and their own private tasks
- Can only delete their own private tasks
- Can only delete their own comments

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port number | No (default: 4000) |
| `NODE_ENV` | Environment mode | No (default: development) |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT signing | Yes |
| `JWT_EXPIRE` | JWT token expiration time | No (default: 30d) |
| `OPENAI_API_KEY` | OpenAI API key for meeting analysis | Yes |
| `NYLAS_API_KEY` | Nylas API key for notetaker | Yes |
| `NYLAS_GRANT_ID` | Nylas Grant ID for notetaker | Yes |
| `WEBHOOK_URL` | Webhook URL for Nylas callbacks | Yes |

## Development Scripts

```bash
npm run dev        # Start development server with hot reload
npm run build      # Compile TypeScript to JavaScript
npm start          # Run compiled JavaScript
npm run lint       # Run linting (if configured)
```

## Troubleshooting

### MongoDB Connection Issues
- Verify your MongoDB URI is correct
- Ensure your IP address is whitelisted in MongoDB Atlas
- Check if MongoDB service is running (for local installations)

### Notetaker Webhook Issues
- Ensure cloudflared tunnel is running
- Verify the webhook URL is correctly configured in Nylas dashboard
- Check that the server is running before starting the tunnel
- Review server logs for webhook payload information

### OpenAI API Errors
- Verify your API key is valid and has sufficient credits
- Check the OpenAI API status page for service disruptions
- Ensure you're using the correct model name in the service

## Security Notes

- Always use strong, unique values for `JWT_SECRET`
- Never commit `.env` files to version control
- Keep your API keys confidential
- Use HTTPS in production
- Regularly rotate API keys and secrets

## License

[Your License Here]

## Support

For issues and questions, please contact [your contact information]