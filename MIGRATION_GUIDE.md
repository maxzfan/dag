# Migration to React + shadcn/ui

This project has been migrated from vanilla JavaScript to React with shadcn/ui components.

## What Changed

### Frontend Architecture
- **Before**: Vanilla JavaScript with custom CSS
- **After**: React + TypeScript + Vite + shadcn/ui + Tailwind CSS

### Key Improvements
1. **Modern UI Components**: Using shadcn/ui for consistent, accessible components
2. **Type Safety**: Full TypeScript support
3. **Better Development Experience**: Hot reload with Vite
4. **Responsive Design**: Tailwind CSS for utility-first styling
5. **Component Architecture**: Reusable React components

## New Project Structure

```
src/
├── components/
│   └── ui/           # shadcn/ui components
├── lib/
│   └── utils.ts      # Utility functions
├── App.tsx           # Main application component
├── main.tsx          # React entry point
└── index.css         # Global styles with Tailwind

```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Key Features

### shadcn/ui Components Used
- **Button**: Modern button component with variants
- **Card**: Container component for content sections
- **Badge**: Status indicators and labels

### Voice AI Features (Preserved)
- Real-time voice recording
- Speech-to-text conversion
- AI conversation handling
- Text-to-speech playback
- Conversation history

## Backend Integration

The React frontend maintains the same API integration:
- Speech-to-text: `POST /speech-to-text`
- AI conversation: `POST /conversation`
- Text-to-speech: `POST /text-to-speech`
- Reset conversation: `POST /reset-conversation`

## Styling

- **Tailwind CSS**: Utility-first CSS framework
- **CSS Variables**: For theme customization
- **Responsive Design**: Mobile-first approach
- **Dark Mode Ready**: CSS variables support theme switching

## Next Steps

1. **Add More Components**: Install additional shadcn/ui components as needed
2. **Customize Theme**: Modify CSS variables in `src/index.css`
3. **Add Animations**: Use Tailwind's animation utilities
4. **Enhance UX**: Add loading states, error handling, etc.

## Legacy Files

The following files are no longer needed:
- `js/app.js` (replaced by React components)
- `css/style.css` (replaced by Tailwind CSS)
- Webpack configuration files (replaced by Vite)

These can be safely removed after confirming the new setup works correctly.
