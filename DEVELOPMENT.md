# closet.city Development Guide

This guide will help you set up a productive development environment for closet.city with GitHub Copilot integration.

## Quick Start

1. **Automated Setup**: Run the setup script
   ```bash
   ./setup-dev.sh
   ```

2. **Manual Setup**: Follow the [README.md](README.md) instructions

3. **Open in VS Code**: Use the workspace file for the best experience
   ```bash
   code closet-city.code-workspace
   ```

## VS Code Configuration

This repository includes a comprehensive VS Code configuration optimized for Copilot development:

### Recommended Extensions
- **GitHub Copilot** - AI pair programmer
- **GitHub Copilot Chat** - Interactive AI assistance
- **TypeScript and JavaScript** - Enhanced language support
- **Tailwind CSS IntelliSense** - CSS utility class completion
- **Prettier** - Code formatting
- **Path Intellisense** - File path completion

### Pre-configured Features
- ✅ TypeScript auto-imports and refactoring
- ✅ Tailwind CSS IntelliSense with custom class detection
- ✅ React/JSX snippets and completions
- ✅ Format on save with Prettier
- ✅ Auto-organize imports
- ✅ Enhanced code completion for strings
- ✅ Copilot enabled for all relevant file types

## Development Workflow

### Using VS Code Tasks
Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and search for "Tasks: Run Task":

- **Install Dependencies** - Install both frontend and backend deps
- **Start Frontend Dev Server** - Run the Vite dev server
- **Start Backend Server** - Run the Node.js gateway
- **Build Frontend** - Create production build
- **Start Full Stack** - Start both servers simultaneously

### Debugging
The workspace includes debug configurations:

1. **Debug Backend Server** - Debug the Node.js backend with breakpoints
2. **Launch Frontend (Chrome)** - Debug React app in Chrome
3. **Launch Full Stack** - Debug both frontend and backend simultaneously

### File Structure
```
closet.city-2/
├── .vscode/                 # VS Code configuration
│   ├── extensions.json      # Recommended extensions
│   ├── settings.json        # Workspace settings
│   ├── tasks.json          # Build and dev tasks
│   └── launch.json         # Debug configurations
├── backend/                 # Node.js gateway server
├── components/              # React components
├── services/                # Frontend services
├── lib/                     # Utility functions
├── src/                     # Additional source files
├── closet-city.code-workspace # VS Code workspace file
├── setup-dev.sh            # Development setup script
└── README.md               # Setup instructions
```

## GitHub Copilot Tips

### Best Practices
1. **Write descriptive comments** - Help Copilot understand your intent
2. **Use TypeScript types** - Provides better context for suggestions
3. **Follow existing patterns** - Copilot learns from your codebase
4. **Break down complex functions** - Smaller functions get better suggestions

### Useful Copilot Commands
- `Ctrl+I` - Inline chat for quick edits
- `Ctrl+Shift+I` - Open Copilot chat panel
- `Tab` - Accept Copilot suggestion
- `Alt+]` - Next suggestion
- `Alt+[` - Previous suggestion

### Example Prompts
```typescript
// Generate a React component for image upload with drag & drop
// Create a TypeScript interface for user authentication
// Write a function to validate email addresses
// Add error handling to this API call
```

## Common Development Tasks

### Adding New Components
1. Create component in `components/` directory
2. Use TypeScript for type safety
3. Follow existing naming conventions
4. Add proper exports

### Working with Backend APIs
1. Backend routes are in `backend/` directory
2. Frontend services are in `services/` directory
3. Use the `API_BASE_URL` constant for endpoints
4. Handle errors gracefully

### Styling Guidelines
1. Use Tailwind CSS classes
2. Leverage VS Code's Tailwind IntelliSense
3. Follow responsive design patterns
4. Use the existing color scheme

## Troubleshooting

### Common Issues
1. **Port conflicts** - Check if ports 3000, 4000, or 5173 are in use
2. **Environment variables** - Ensure `.env` files are properly configured
3. **Node version** - Requires Node.js 20+
4. **Dependencies** - Run `npm install` in both root and backend directories

### Getting Help
1. Use GitHub Copilot Chat for code questions
2. Check the repository's Issues tab
3. Review the README.md for setup instructions
4. Look at existing code for patterns and examples

## Contributing

1. Follow the existing code style
2. Use TypeScript for new files
3. Add comments for complex logic
4. Test changes locally before committing
5. Use descriptive commit messages

## Performance Tips

### Development
- Use the Vite dev server for fast hot reloading
- Enable VS Code's auto-save for immediate feedback
- Use the debugger instead of console.log when possible

### Production
- Run `npm run build` to create optimized bundles
- Test the production build with `npm run preview`
- Monitor bundle size and performance

Happy coding with Copilot! 🚀