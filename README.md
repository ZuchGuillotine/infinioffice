# InfiniOffice

A comprehensive office management system that integrates calendar, telephony, speech-to-text, text-to-speech, and LLM services to create an intelligent office assistant.

## Features

- **Calendar Management**: Schedule and manage meetings, appointments, and events
- **Telephony Integration**: Handle phone calls and voice communications
- **Speech-to-Text (STT)**: Convert spoken words to text for processing
- **Text-to-Speech (TTS)**: Convert text responses to speech
- **LLM Integration**: Intelligent conversation and task processing
- **Database Management**: Prisma-based data persistence
- **Comprehensive Testing**: Unit tests for all services

## Project Structure

```
InfiniOffice/
├── Docs/                    # Project documentation
├── prisma/                  # Database schema and migrations
├── src/                     # Source code
│   ├── config/             # Configuration files
│   ├── routes/             # API routes
│   ├── services/           # Core services
│   └── utils/              # Utility functions
├── tests/                  # Test files
└── package.json            # Dependencies and scripts
```

## Services

- **Calendar Service**: Manages scheduling and calendar operations
- **Database Service**: Handles data persistence and queries
- **LLM Service**: Integrates with language models for intelligent responses
- **STT Service**: Speech-to-text conversion
- **TTS Service**: Text-to-speech conversion
- **Telephony Service**: Phone call management

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Database (configured in Prisma schema)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/infinioffice.git
   cd infinioffice
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Run tests:
   ```bash
   npm test
   ```

6. Start the application:
   ```bash
   npm start
   ```

## Testing

Run the test suite:
```bash
npm test
```

Individual service tests:
```bash
npm test calendar.test.js
npm test db.test.js
npm test llm.test.js
npm test stt.test.js
npm test telephony.test.js
npm test tts.test.js
```

## Documentation

See the `Docs/` directory for detailed project documentation:
- [Project Requirements](Docs/Project_Requirments.md)
- [Technical Architecture](Docs/Project_Architecture.md)
- [Tech Stack](Docs/Tech_Stack.md)
- [MVP Implementation](Docs/InfiniOfficeMVPImplementation.md)
- [Sprint 01](Docs/Sprint_01.md)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions or support, please open an issue on GitHub. 