import { useState, useRef, useEffect } from 'react'

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new(): SpeechRecognition
    }
  }
}
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, MessageSquare, History, Trash2, Bot } from 'lucide-react'

interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: Date
}

interface JournalEntry {
  id: string
  title: string
  timestamp: string
  messages: Message[]
  summary?: string
}

function App() {
  const [mode, setMode] = useState<'agent' | 'journal'>('agent')
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('Click to start recording')
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [currentSummary, setCurrentSummary] = useState('')
  
  const audioPlaybackRef = useRef<HTMLAudioElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const apiBaseUrl = 'http://localhost:5001'

  // Available agents for the dashboard - will be populated by agent mode system
  const availableAgents = []

  useEffect(() => {
    checkMicrophonePermission()
    loadJournalEntries()
    initializeSpeechRecognition()
  }, [])

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      
      recognition.onstart = () => {
        console.log('Speech recognition started')
      }
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          currentTranscript += transcript
        }
        
        // Update live transcript with current results
        setLiveTranscript(currentTranscript)
      }
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        setStatus(`Speech recognition error: ${event.error}`)
      }
      
      recognition.onend = () => {
        console.log('Speech recognition ended')
        if (isRecording) {
          // Restart recognition if we're still recording
          setTimeout(() => {
            if (isRecording && recognitionRef.current) {
              try {
                recognitionRef.current.start()
              } catch (error) {
                console.warn('Failed to restart speech recognition:', error)
              }
            }
          }, 100)
        }
      }
      
      recognitionRef.current = recognition
    } else {
      console.warn('Speech recognition not supported in this browser')
    }
  }

  const loadJournalEntries = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/journal-entries`)
      if (response.ok) {
        const data = await response.json()
        setJournalEntries(data.entries)
      }
    } catch (error) {
      console.error('Error loading journal entries:', error)
    }
  }

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight
    }
  }, [messages])

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setStatus('Ready to start conversation')
    } catch (error) {
      setStatus('Microphone permission required')
      console.error('Microphone access denied:', error)
    }
  }

  const startRecording = async () => {
    try {
      // Clear previous transcript
      setLiveTranscript('')
      
      // Start live speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start()
          setIsRecording(true)
          setStatus('🎤 Recording... Click to stop')
        } catch (error) {
          console.warn('Speech recognition failed to start:', error)
          setStatus('Error starting speech recognition')
        }
      } else {
        setStatus('Speech recognition not available')
      }

    } catch (error) {
      console.error('Error starting recording:', error)
      setStatus('Error accessing microphone')
    }
  }

  const stopRecording = () => {
    if (isRecording) {
      // Stop speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          console.warn('Error stopping speech recognition:', error)
        }
      }
      
      setIsRecording(false)
      setStatus('Processing...')
      setIsProcessing(true)
      
      // Process the transcript immediately
      processRecording()
    }
  }

  const handleToggleRecording = () => {
    if (isProcessing) return
    
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const processRecording = async () => {
    try {
      // Use only the live transcript - no backend fallback
      const transcribedText = liveTranscript.trim()

      if (transcribedText && transcribedText.length > 0) {
        const userMessage: Message = {
          id: Date.now().toString(),
          sender: 'user',
          text: transcribedText,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, userMessage])

        const aiResponse = await getAIResponse(transcribedText)
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: aiResponse,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])

        await textToSpeech(aiResponse)
      } else {
        setStatus('No speech detected. Try speaking louder or longer.')
      }

      // Clear live transcript after processing
      setLiveTranscript('')
      setIsProcessing(false)
      setStatus('Click to start recording')

    } catch (error) {
      console.error('Error processing recording:', error)
      setStatus('Error processing your message: ' + (error as Error).message)
      setIsProcessing(false)
    }
  }


  const getAIResponse = async (text: string) => {
    const response = await fetch(`${apiBaseUrl}/conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error(`AI response failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.response
  }

  const textToSpeech = async (text: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        throw new Error(`Text-to-speech failed: ${response.statusText}`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.src = audioUrl
        audioPlaybackRef.current.play()
      }

    } catch (error) {
      console.error('Error with text-to-speech:', error)
      setStatus('Voice response failed, but text is shown above')
    }
  }

  const saveJournalEntry = async () => {
    if (messages.length === 0) return

    setIsSaving(true)
    
    try {
      // Generate a dynamic title based on conversation content
      const conversationText = messages.map(msg => `${msg.sender}: ${msg.text}`).join('\n')
      
      const response = await fetch(`${apiBaseUrl}/generate-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: conversationText })
      })

      let title = `Journal ${new Date().toLocaleDateString()}` // fallback title
      
      if (response.ok) {
        const data = await response.json()
        title = data.title || title
      } else {
        console.warn('Failed to generate title, using fallback')
      }
      
      const newEntry: JournalEntry = {
        id: Date.now().toString(),
        title: title,
        timestamp: new Date().toISOString(),
        messages: [...messages]
      }

      setJournalEntries(prev => [newEntry, ...prev])
      
    } catch (error) {
      console.error('Error generating title:', error)
      // Use fallback title if title generation fails
      const newEntry: JournalEntry = {
        id: Date.now().toString(),
        title: `Journal ${new Date().toLocaleDateString()}`,
        timestamp: new Date().toISOString(),
        messages: [...messages]
      }
      setJournalEntries(prev => [newEntry, ...prev])
    }
    
    // Reset animation after delay
    setTimeout(() => {
      setIsSaving(false)
    }, 800)
  }

  const loadJournalEntry = (entryId: string) => {
    const entry = journalEntries.find(e => e.id === entryId)
    if (entry) {
      setMessages(entry.messages)
      setSelectedEntry(entryId)
    }
  }

  const showConversationSummary = (entryId: string) => {
    const entry = journalEntries.find(e => e.id === entryId)
    if (entry && entry.summary) {
      setCurrentSummary(entry.summary)
      setShowSummary(true)
    }
  }

  const deleteJournalEntry = async (entryId: string) => {
    try {
      // Call backend to delete the JSON file
      const response = await fetch(`${apiBaseUrl}/journal-entries/${entryId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete journal entry: ${response.statusText}`)
      }

      // Update local state only after successful backend deletion
      setJournalEntries(prev => prev.filter(e => e.id !== entryId))
      if (selectedEntry === entryId) {
        setSelectedEntry(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Error deleting journal entry:', error)
      setStatus('Error deleting journal entry: ' + (error as Error).message)
    }
  }

  const resetConversation = async () => {
    try {
      await fetch(`${apiBaseUrl}/reset-conversation`, {
        method: 'POST'
      })

      setMessages([])
      setSelectedEntry(null)
      setStatus('Conversation reset. Ready to start fresh!')

    } catch (error) {
      console.error('Error resetting conversation:', error)
      setMessages([])
      setSelectedEntry(null)
      setStatus('Conversation reset locally')
    }
  }

  const startNewConversation = async () => {
    try {
      await fetch(`${apiBaseUrl}/start-new-conversation`, {
        method: 'POST'
      })

      setMessages([])
      setSelectedEntry(null)
      setStatus('New conversation started. Ready to chat!')

    } catch (error) {
      console.error('Error starting new conversation:', error)
      setStatus('Error starting new conversation')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 dark:border-gray-800 px-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-3">
            <img 
              src="/assets/icons/nexus-icon.png" 
              alt="Daggy" 
              className="w-8 h-8"
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-50 to-amber-100 bg-clip-text text-transparent">
              DAGR
            </h1>
          </div>
          
          {/* Mode Toggle Links - moved next to name */}
          <div className="flex items-center gap-6 ml-6">
            <button
              onClick={() => setMode('agent')}
              className={`text-sm font-medium transition-colors hover:text-amber-300 ${
                mode === 'agent' 
                  ? 'text-amber-300' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Agent
            </button>
            <button
              onClick={() => setMode('journal')}
              className={`text-sm font-medium transition-colors hover:text-amber-300 ${
                mode === 'journal' 
                  ? 'text-amber-300' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Journal
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-4 p-4">
        {mode === 'agent' ? (
          /* Agent Mode - Dashboard Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* Left Side - Voice Button */}
            <div className="lg:col-span-1">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Mic className="w-5 h-5" />
                    Voice Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center space-y-6 h-full">
                  <Badge 
                    variant={isRecording ? "destructive" : isProcessing ? "secondary" : "default"}
                    className={`text-sm px-4 py-2 ${isRecording ? 'animate-pulse' : ''} ${
                      !isRecording && !isProcessing ? 'bg-gradient-to-r from-amber-50 to-amber-100 text-gray-700 border-amber-200' : ''
                    }`}
                  >
                    {status}
                  </Badge>
                  
                  <Button
                    onClick={handleToggleRecording}
                    disabled={isProcessing}
                    size="lg"
                    className={`
                      w-24 h-24 rounded-full text-gray-800 font-semibold text-lg
                      transition-all duration-200 ease-in-out
                      ${isRecording 
                        ? 'bg-red-500 hover:bg-red-600 scale-110' 
                        : 'bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 hover:scale-105'
                      }
                      ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      active:scale-95
                    `}
                  >
                    <Mic className="w-8 h-8" />
                  </Button>

                  {selectedAgent && (
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Active Agent:</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {availableAgents.find(a => a.id === selectedAgent)?.name}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Agent List */}
            <div className="lg:col-span-2">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-full">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Available Agents</CardTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Agents will appear here when the system determines which ones to deploy
                  </p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {availableAgents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <Bot className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No agents available
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                          The agent mode system will analyze your needs and deploy specialized agents here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {availableAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              selectedAgent === agent.id
                                ? 'bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-300'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                            onClick={() => setSelectedAgent(agent.id)}
                          >
                            <div className="text-xl">{agent.icon}</div>
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {agent.name}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {agent.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                agent.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                              }`}></div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {agent.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Journal Mode - Current UI */
          <>
        {/* Top Row - Voice Button and Transcript */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Voice Button - Top Left */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Mic className="w-5 h-5" />
                Voice Control
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Badge 
                variant={isRecording ? "destructive" : isProcessing ? "secondary" : "default"}
                className={`text-sm px-4 py-2 ${isRecording ? 'animate-pulse' : ''} ${
                  !isRecording && !isProcessing ? 'bg-gradient-to-r from-amber-50 to-amber-100 text-gray-700 border-amber-200' : ''
                }`}
              >
                {status}
              </Badge>
              
              <Button
                onClick={handleToggleRecording}
                disabled={isProcessing}
                size="lg"
                className={`
                  w-24 h-24 rounded-full text-gray-800 font-semibold text-lg
                  transition-all duration-200 ease-in-out
                  ${isRecording 
                    ? 'bg-red-500 hover:bg-red-600 scale-110' 
                    : 'bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 hover:scale-105'
                  }
                  ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  active:scale-95
                `}
              >
                <Mic className="w-8 h-8" />
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={saveJournalEntry}
                  variant="outline"
                  size="sm"
                  disabled={messages.length === 0 || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Journal'}
                </Button>
                <Button
                  onClick={startNewConversation}
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  className="text-black hover:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  New Chat
                </Button>
                <Button
                  onClick={resetConversation}
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transcript Box - Top Right */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <MessageSquare className="w-5 h-5" />
                Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[160px] p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
                {liveTranscript ? (
                  <span className="text-gray-600 dark:text-gray-300 italic">
                    {liveTranscript}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic">
                    {isRecording ? 'Listening...' : 'Start recording to see transcription'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Half - Journal History */}
        <Card className="flex-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <History className="w-5 h-5" />
              Journal Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[400px]">
              {/* Journal Entries List */}
              <div className="lg:col-span-1">
                <h3 className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Previous Journal Entries</h3>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {journalEntries.map((entry, index) => (
                      <Card 
                        key={entry.id}
                        className={`cursor-pointer transition-colors bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${
                          selectedEntry === entry.id 
                            ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-500' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        } ${
                          index === 0 && isSaving ? 'chat-history-enter' : ''
                        }`}
                        onClick={() => loadJournalEntry(entry.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{entry.title}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(entry.timestamp).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {entry.messages.length} messages
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteJournalEntry(entry.id)
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {journalEntries.length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No journal entries yet
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Current Messages */}
              <div className="lg:col-span-2 -mt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-white">Current Conversation</h3>
                  {selectedEntry && journalEntries.find(e => e.id === selectedEntry)?.summary && (
                    <Button
                      onClick={() => showConversationSummary(selectedEntry)}
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      View Summary
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[300px]">
                  <div 
                    ref={conversationRef}
                    className={`space-y-4 pr-4 ${
                      isSaving 
                        ? 'chat-archive-animation' 
                        : ''
                    }`}
                  >
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl p-4 ${
                            message.sender === 'user'
                              ? 'bg-gradient-to-r from-amber-50 to-amber-100 text-gray-700'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                          }`}
                        >
                          <div className="text-xs font-medium mb-2 opacity-80">
                            {message.sender === 'user' ? 'You' : 'Daggy AI'}
                          </div>
                          <div className="text-sm leading-relaxed">{message.text}</div>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && !isSaving && (
                      <div className="text-sm text-gray-500 text-center py-8">
                        Start a conversation by clicking the voice button
                      </div>
                    )}
                    {isSaving && (
                      <div className="text-sm text-yellow-600 text-center py-8 flex items-center justify-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
                        Saving conversation...
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {/* Hidden Audio */}
      <div className="hidden">
        <audio ref={audioPlaybackRef} controls />
      </div>

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Conversation Summary</h2>
              <Button
                onClick={() => setShowSummary(false)}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
              <p className="whitespace-pre-wrap leading-relaxed">{currentSummary}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setShowSummary(false)}
                variant="outline"
                className="text-gray-600 hover:text-gray-800"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App