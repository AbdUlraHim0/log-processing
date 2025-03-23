# Real-Time Log Processing Microservice

A full-stack application for asynchronous processing of large log files with real-time monitoring and analytics.

## Features

- **Scalable Log Processing**: Efficiently handle log files up to 1GB using streaming and concurrency
- **Real-time Updates**: Track processing progress via WebSockets with SSE and polling fallbacks
- **Detailed Analytics**: View statistics on errors, keyword matches, and IP addresses
- **Fault Tolerant**: Resilient processing with automatic retries and error handling
- **Secure Authentication**: User authentication through Supabase (email/password and GitHub OAuth)
- **Responsive UI**: Modern dashboard with dark mode support

## Architecture

This project uses a microservice architecture with the following components:

- **Frontend**: Next.js 15.x with React 18.x
- **Backend**: Node.js 20.x with Express
- **Message Queue**: BullMQ with Redis for asynchronous job processing
- **Authentication & Storage**: Supabase for auth, database, and file storage
- **Deployment**: Docker and docker-compose for containerization

## Technology Stack

- **Frontend**: Next.js 15.x, React 18.x, Tailwind CSS, Recharts
- **Backend**: Node.js 20.x, BullMQ, Streams API
- **Database**: Supabase (PostgreSQL)
- **Message Queue**: Redis, BullMQ
- **Real-time**: WebSockets, Server-Sent Events, Polling
- **Authentication**: Supabase Auth (JWT)
- **Storage**: Supabase Storage
- **Containerization**: Docker, docker-compose
- **Testing**: Jest

## Project Structure

```
.
├── docker-compose.yml
├── package.json
├── packages
│   ├── shared             # Shared types and utilities
│   │   ├── package.json
│   │   └── src
│   │       ├── index.ts
│   │       ├── types.ts
│   │       └── utils
│   │           └── rate-limiter.ts
│   ├── web                # Next.js frontend application
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src
│   │       ├── app
│   │       │   ├── api    # API routes
│   │       │   ├── auth   # Authentication pages
│   │       │   └── dashboard   # Dashboard pages
│   │       ├── components # React components
│   │       ├── context    # React context providers
│   │       ├── hooks      # Custom React hooks
│   │       ├── libs       # Utility libraries
│   │       └── utils      # Helper functions
│   └── worker             # Log processing worker
│       ├── Dockerfile
│       ├── package.json
│       └── src
│           └── logProcessingWorker.ts
```

## Setup Instructions

### Prerequisites

- Docker and docker-compose
- Node.js 20.x (for local development)
- Supabase account (for production)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Worker Configuration
MONITORED_KEYWORDS=error,exception,failure,timeout,crash
WORKER_CONCURRENCY=4
USE_CLUSTER=false
PROCESS_TIMEOUT_MS=180000
BATCH_SIZE=1000
MAX_MEMORY_PERCENT=80

# Next.js Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Database Schema

Set up the following tables in your Supabase project:

1. **log_stats**

   ```sql
   CREATE TABLE log_stats (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     jobId VARCHAR NOT NULL,
     userId UUID REFERENCES auth.users(id),
     fileName VARCHAR NOT NULL,
     filePath VARCHAR NOT NULL,
     fileSize BIGINT NOT NULL,
     status VARCHAR NOT NULL,
     progress INTEGER DEFAULT 0,
     totalEntries INTEGER DEFAULT 0,
     errorCount INTEGER DEFAULT 0,
     keywordMatches JSONB DEFAULT '{}'::jsonb,
     ipAddresses JSONB DEFAULT '{}'::jsonb,
     processingTime BIGINT DEFAULT 0,
     error TEXT,
     createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
     updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
     completedAt TIMESTAMP WITH TIME ZONE
   );
   ```

2. **profiles**

   ```sql
   CREATE TABLE profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id),
     email VARCHAR NOT NULL,
     is_admin BOOLEAN DEFAULT false,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
   );
   ```

3. Create a storage bucket named `log-files` with appropriate security rules.

### Development Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd log-processing-microservice
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

### Running the Application

#### Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start a local Redis server (or use Docker):

   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

3. Run the development server:

   ```bash
   # Start all packages in development mode
   npm run dev

   # Or start individual packages
   npm run dev:web     # Start Next.js frontend only
   npm run dev:worker  # Start worker process only
   ```

4. Open your browser to `http://localhost:3000`

#### Docker Deployment

1. Make sure your `.env` file is properly configured with all required environment variables.

2. Build and start the containers:

   ```bash
   docker-compose up -d
   ```

3. Monitor the logs:

   ```bash
   # View all logs
   docker-compose logs -f

   # View logs for a specific service
   docker-compose logs -f web
   docker-compose logs -f worker
   docker-compose logs -f redis
   ```

4. Scale worker containers for increased throughput:

   ```bash
   docker-compose up -d --scale worker=4
   ```

5. Access the application at `http://localhost:3000`

#### Sample Log File Setup

The application comes with a sample log file for testing:

1. Sign in to the application
2. Go to the Dashboard
3. Use the file upload section to upload the sample log file from the `samples/` directory
4. Monitor the progress in the queue section

#### Troubleshooting

- **Redis Connection Issues**: Ensure Redis is running and accessible on the configured host and port
- **Supabase Authentication Errors**: Verify that your Supabase credentials are correct and the service is running
- **Worker Process Not Starting**: Check the worker logs for errors using `docker-compose logs -f worker`
- **File Upload Failures**: Ensure the Supabase storage bucket 'log-files' exists and has proper permissions

## Architecture Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  Next.js    │ ───────▶│   BullMQ    │ ───────▶│  Worker     │
│  Frontend   │         │   Queue     │         │  Process    │
│             │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
       │                       │                      │
       │                       │                      │
       ▼                       ▼                      ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  WebSockets │◀────────│   Redis     │◀────────│ File        │
│  API        │         │   PubSub    │         │ Processing  │
│             │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
       │                                               │
       │                                               │
       ▼                                               ▼
┌─────────────┐                               ┌─────────────┐
│             │                               │             │
│  Client     │                               │  Supabase   │
│  Browser    │                               │  Storage    │
│             │                               │             │
└─────────────┘                               └─────────────┘
```

## Future Improvements

- Add unit and integration tests (Jest) for robust test coverage
- Implement log pattern detection using machine learning
- Add export functionality for analytics results (CSV, PDF)
- Implement real-time alerting based on error patterns
- Support for more log formats (JSON, XML, custom patterns)
- Geographic IP visualization with mapping integration

## License

MIT
