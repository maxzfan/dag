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
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, MessageSquare, History, Trash2 } from 'lucide-react'

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
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('Click to start recording')
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlaybackRef = useRef<HTMLAudioElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const apiBaseUrl = 'http://localhost:5001'

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
        let interimTranscript = ''
        let finalTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }
        
        // Update live transcript with interim results
        setLiveTranscript(interimTranscript)
        
        // If we have final results, update the main transcript
        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript)
        }
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
      // Clear previous transcripts
      setLiveTranscript('')
      setTranscript('')
      
      // Start live speech recognition only if not already started
      if (recognitionRef.current && !isRecording) {
        try {
          recognitionRef.current.start()
        } catch (error) {
          console.warn('Speech recognition already started or failed to start:', error)
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ]

      let selectedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        processRecording()
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setStatus('Recording error occurred')
      }

      mediaRecorder.start(1000)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setStatus('🎤 Recording... Click to stop')

    } catch (error) {
      console.error('Error starting recording:', error)
      setStatus('Error accessing microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          console.warn('Error stopping speech recognition:', error)
        }
      }
      
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setStatus('Processing...')
      setIsProcessing(true)
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
      // Use the live transcript if available, otherwise fall back to backend transcription
      let transcribedText = transcript.trim()
      
      // If we have live transcript but no final transcript, use the live one
      if (!transcribedText && liveTranscript.trim()) {
        transcribedText = liveTranscript.trim()
        setTranscript(transcribedText)
      }
      
      // If still no text, try backend transcription as fallback
      if (!transcribedText && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        
        if (audioBlob.size > 1000) {
          transcribedText = await speechToText(audioBlob)
          if (transcribedText && transcribedText.trim()) {
            setTranscript(transcribedText)
          }
        }
      }

      if (transcribedText && transcribedText.trim()) {
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

  const speechToText = async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')

    const response = await fetch(`${apiBaseUrl}/speech-to-text`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Speech-to-text failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.text
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

  const saveJournalEntry = () => {
    if (messages.length === 0) return

    setIsSaving(true)
    
    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      title: `Journal ${new Date().toLocaleDateString()}`,
      timestamp: new Date().toISOString(),
      messages: [...messages]
    }

    setJournalEntries(prev => [newEntry, ...prev])
    
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

  const deleteJournalEntry = (entryId: string) => {
    setJournalEntries(prev => prev.filter(e => e.id !== entryId))
    if (selectedEntry === entryId) {
      setSelectedEntry(null)
      setMessages([])
    }
  }

  const resetConversation = async () => {
    try {
      await fetch(`${apiBaseUrl}/reset-conversation`, {
        method: 'POST'
      })

      setMessages([])
      setTranscript('')
      setSelectedEntry(null)
      setStatus('Conversation reset. Ready to start fresh!')

    } catch (error) {
      console.error('Error resetting conversation:', error)
      setMessages([])
      setTranscript('')
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
      setTranscript('')
      setSelectedEntry(null)
      setStatus('New conversation started. Ready to chat!')

    } catch (error) {
      console.error('Error starting new conversation:', error)
      setStatus('Error starting new conversation')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 px-4">
          <div className="flex items-center space-x-3">
            <img 
              src="/assets/icons/nexus-icon.png" 
              alt="Daggy" 
              className="w-8 h-8"
            />
            <h1 className="text-xl font-bold text-yellow-100">
              Daggy
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Top Row - Voice Button and Transcript */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Voice Button - Top Left */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Voice Control
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Badge 
                variant={isRecording ? "destructive" : isProcessing ? "secondary" : "default"}
                className={`text-sm px-4 py-2 ${isRecording ? 'animate-pulse' : ''}`}
              >
                {status}
              </Badge>
              
              <Button
                onClick={handleToggleRecording}
                disabled={isProcessing}
                size="lg"
                className={`
                  w-24 h-24 rounded-full text-black font-semibold text-lg
                  transition-all duration-200 ease-in-out
                  ${isRecording 
                    ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-2xl shadow-red-500/50' 
                    : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 hover:scale-105 shadow-xl shadow-yellow-500/30'
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
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Live Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Final Transcript:
                </div>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your transcribed speech will appear here..."
                  className="min-h-[80px] resize-none"
                  readOnly
                />
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Live Transcript:
                </div>
                <div className="min-h-[80px] p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
                  {liveTranscript ? (
                    <span className="text-gray-600 dark:text-gray-300 italic">
                      {liveTranscript}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">
                      {isRecording ? 'Listening...' : 'Start recording to see live transcription'}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Half - Journal History */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Journal Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[400px]">
              {/* Journal Entries List */}
              <div className="lg:col-span-1">
                <h3 className="text-sm font-medium mb-2">Previous Journal Entries</h3>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {journalEntries.map((entry, index) => (
                      <Card 
                        key={entry.id}
                        className={`cursor-pointer transition-colors ${
                          selectedEntry === entry.id 
                            ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-500' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        } ${
                          index === 0 && isSaving ? 'chat-history-enter' : ''
                        }`}
                        onClick={() => loadJournalEntry(entry.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium">{entry.title}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(entry.timestamp).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-400">
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
              <div className="lg:col-span-2">
                <h3 className="text-sm font-medium mb-2">Current Conversation</h3>
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
                              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
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
      </div>

      {/* Hidden Audio */}
      <div className="hidden">
        <audio ref={audioPlaybackRef} controls />
      </div>
    </div>
  )
}

export default App