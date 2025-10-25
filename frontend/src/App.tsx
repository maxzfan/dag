import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, MessageSquare, History } from 'lucide-react'

interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: Date
}

interface ChatHistory {
  id: string
  title: string
  timestamp: Date
  messages: Message[]
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('Click to start recording')
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([])
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlaybackRef = useRef<HTMLAudioElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)

  const apiBaseUrl = '/api'

  useEffect(() => {
    checkMicrophonePermission()
  }, [])

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
      if (audioChunksRef.current.length === 0) {
        setStatus('No audio data recorded. Try again.')
        setIsProcessing(false)
        return
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

      if (audioBlob.size < 1000) {
        setStatus('Recording too short. Please speak longer.')
        setIsProcessing(false)
        return
      }

      const transcribedText = await speechToText(audioBlob)

      if (transcribedText && transcribedText.trim()) {
        setTranscript(transcribedText)
        
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

  const saveChatHistory = () => {
    if (messages.length === 0) return

    const newHistory: ChatHistory = {
      id: Date.now().toString(),
      title: `Chat ${new Date().toLocaleDateString()}`,
      timestamp: new Date(),
      messages: [...messages]
    }

    setChatHistories(prev => [newHistory, ...prev])
  }

  const loadChatHistory = (historyId: string) => {
    const history = chatHistories.find(h => h.id === historyId)
    if (history) {
      setMessages(history.messages)
      setSelectedHistory(historyId)
    }
  }

  const resetConversation = async () => {
    // If there are messages, animate them into history first
    if (messages.length > 0) {
      setIsAnimating(true)
      
      // Create history entry
      const newHistory: ChatHistory = {
        id: Date.now().toString(),
        title: `Chat ${new Date().toLocaleDateString()}`,
        timestamp: new Date(),
        messages: [...messages]
      }
      
      // Add to history
      setChatHistories(prev => [newHistory, ...prev])
      
      // Wait for animation to complete
      setTimeout(async () => {
        try {
          await fetch(`${apiBaseUrl}/reset-conversation`, {
            method: 'POST'
          })

          setMessages([])
          setTranscript('')
          setSelectedHistory(null)
          setStatus('Conversation reset. Ready to start fresh!')
          setIsAnimating(false)

        } catch (error) {
          console.error('Error resetting conversation:', error)
          setMessages([])
          setTranscript('')
          setSelectedHistory(null)
          setStatus('Conversation reset locally')
          setIsAnimating(false)
        }
      }, 800) // Animation duration
    } else {
      // No messages to animate, just reset normally
      try {
        await fetch(`${apiBaseUrl}/reset-conversation`, {
          method: 'POST'
        })

        setMessages([])
        setTranscript('')
        setSelectedHistory(null)
        setStatus('Conversation reset. Ready to start fresh!')

      } catch (error) {
        console.error('Error resetting conversation:', error)
        setMessages([])
        setTranscript('')
        setSelectedHistory(null)
        setStatus('Conversation reset locally')
      }
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
                  onClick={saveChatHistory}
                  variant="outline"
                  size="sm"
                  disabled={messages.length === 0}
                >
                  Save Chat
                </Button>
                <Button
                  onClick={resetConversation}
                  variant="outline"
                  size="sm"
                  disabled={isAnimating}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {isAnimating ? 'Archiving...' : 'Reset'}
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
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Your transcribed speech will appear here..."
                className="min-h-[200px] resize-none"
                readOnly
              />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Half - Chat History */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Chat History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[400px]">
              {/* Chat Histories List */}
              <div className="lg:col-span-1">
                <h3 className="text-sm font-medium mb-2">Previous Conversations</h3>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {chatHistories.map((history, index) => (
                      <Card 
                        key={history.id}
                        className={`cursor-pointer transition-colors ${
                          selectedHistory === history.id 
                            ? 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-500' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        } ${
                          index === 0 && isAnimating ? 'chat-history-enter' : ''
                        }`}
                        onClick={() => loadChatHistory(history.id)}
                      >
                        <CardContent className="p-3">
                          <div className="text-sm font-medium">{history.title}</div>
                          <div className="text-xs text-gray-500">
                            {history.timestamp.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {history.messages.length} messages
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {chatHistories.length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No chat histories yet
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
                      isAnimating 
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
                    {messages.length === 0 && !isAnimating && (
                      <div className="text-sm text-gray-500 text-center py-8">
                        Start a conversation by clicking the voice button
                      </div>
                    )}
                    {isAnimating && (
                      <div className="text-sm text-yellow-600 text-center py-8 flex items-center justify-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
                        Archiving conversation...
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