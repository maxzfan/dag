import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mic, Square, RotateCcw, Volume2 } from 'lucide-react'

interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: Date
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('Ready to start conversation')
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  
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
      setStatus('🎤 Recording... Speak now!')

    } catch (error) {
      console.error('Error starting recording:', error)
      setStatus('Error accessing microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setStatus('Processing your message...')
      setIsProcessing(true)
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
      setStatus('Ready to start conversation')

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

  const resetConversation = async () => {
    try {
      await fetch(`${apiBaseUrl}/reset-conversation`, {
        method: 'POST'
      })

      setMessages([])
      setStatus('Conversation reset. Ready to start fresh!')

    } catch (error) {
      console.error('Error resetting conversation:', error)
      setMessages([])
      setStatus('Conversation reset locally')
    }
  }

  return (
    <div className="min-h-screen nexus-gradient nexus-grid">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6 nexus-card nexus-glow">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold nexus-text-gradient">
              Nexus
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Advanced Voice AI Conversation Platform
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="mb-6 nexus-card nexus-border">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <Badge 
                variant={isRecording ? "destructive" : isProcessing ? "secondary" : "default"}
                className={`text-sm px-4 py-2 ${isRecording ? 'nexus-pulse' : ''}`}
              >
                {status}
              </Badge>
            </div>

            <div className="flex justify-center gap-4 mb-6">
              <Button
                onClick={startRecording}
                disabled={isRecording || isProcessing}
                className="nexus-button flex items-center gap-2 text-white font-semibold"
                size="lg"
              >
                <Mic className="h-4 w-4" />
                Start Recording
              </Button>
              
              <Button
                onClick={stopRecording}
                disabled={!isRecording}
                variant="destructive"
                className="flex items-center gap-2 hover:bg-red-600 transition-all duration-300"
                size="lg"
              >
                <Square className="h-4 w-4" />
                Stop Recording
              </Button>
              
              <Button
                onClick={resetConversation}
                variant="outline"
                className="nexus-border flex items-center gap-2 hover:bg-accent transition-all duration-300"
                size="lg"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="hidden">
              <audio ref={audioPlaybackRef} controls />
            </div>
          </CardContent>
        </Card>

        <Card className="nexus-card nexus-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Volume2 className="h-5 w-5 nexus-text-gradient" />
              <span className="nexus-text-gradient">Conversation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              ref={conversationRef}
              className="max-h-96 overflow-y-auto space-y-4 p-4 bg-muted/20 rounded-lg border border-border/50"
            >
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="nexus-text-gradient text-lg font-semibold mb-2">
                    Ready to Connect
                  </div>
                  <p className="text-muted-foreground">
                    Start recording to begin your AI conversation
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.sender === 'user'
                          ? 'bg-primary text-primary-foreground nexus-glow'
                          : 'bg-secondary text-secondary-foreground nexus-border'
                      }`}
                    >
                      <div className="text-xs font-medium mb-2 opacity-80 flex items-center gap-1">
                        {message.sender === 'user' ? (
                          <>
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            You
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-green-400 rounded-full nexus-pulse"></div>
                            Nexus AI
                          </>
                        )}
                      </div>
                      <div className="text-sm leading-relaxed">{message.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App
