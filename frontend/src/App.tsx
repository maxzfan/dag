import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Mic, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: Date
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('Click to start recording')
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  
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
      setIsChatOpen(true)

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Nexus
        </h1>
        <p className="text-slate-400">Advanced Voice AI Platform</p>
      </div>

      {/* Main Interface */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Status */}
        <div className="mb-8">
          <Badge 
            variant={isRecording ? "destructive" : isProcessing ? "secondary" : "default"}
            className={`text-sm px-4 py-2 ${isRecording ? 'animate-pulse' : ''}`}
          >
            {status}
          </Badge>
        </div>

        {/* Toggle Recording Button */}
        <div className="mb-8">
          <Button
            onClick={handleToggleRecording}
            disabled={isProcessing}
            className={`
              w-32 h-32 rounded-full text-white font-semibold text-lg
              transition-all duration-200 ease-in-out
              ${isRecording 
                ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-2xl shadow-red-500/50' 
                : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 hover:scale-105 shadow-xl shadow-emerald-500/30'
              }
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              active:scale-95
            `}
          >
            <Mic className="w-8 h-8" />
          </Button>
        </div>

        {/* Chat Toggle */}
        {messages.length > 0 && (
          <Collapsible open={isChatOpen} onOpenChange={setIsChatOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="mb-4">
                <MessageSquare className="w-4 h-4 mr-2" />
                View Conversation
                {isChatOpen ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="w-full max-w-2xl">
                <CardContent className="p-4">
                  <div 
                    ref={conversationRef}
                    className="max-h-96 overflow-y-auto space-y-4"
                  >
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.sender === 'user'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          <div className="text-xs font-medium mb-1 opacity-80">
                            {message.sender === 'user' ? 'You' : 'Nexus AI'}
                          </div>
                          <div className="text-sm">{message.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Reset Button */}
        {messages.length > 0 && (
          <Button
            onClick={resetConversation}
            variant="outline"
            className="mt-4"
          >
            Reset Conversation
          </Button>
        )}
      </div>

      {/* Hidden Audio */}
      <div className="hidden">
        <audio ref={audioPlaybackRef} controls />
      </div>
    </div>
  )
}

export default App
