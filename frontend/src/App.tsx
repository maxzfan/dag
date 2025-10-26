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
import { Mic, MessageSquare, History, Trash2, Bot, RefreshCw } from 'lucide-react'
import { AgentDashboard } from '@/components/AgentDashboard'

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
  const [mode, setMode] = useState<'agent' | 'journal'>('journal')
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showAgentDashboard, setShowAgentDashboard] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('Click to start recording')
  const [messages, setMessages] = useState<Message[]>([])
  const [agentMessages, setAgentMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [currentSummary, setCurrentSummary] = useState('')
  const [showAgentChatHistory, setShowAgentChatHistory] = useState(false)
  
  const audioPlaybackRef = useRef<HTMLAudioElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const apiBaseUrl = 'http://localhost:5001'

  // Available agents for the dashboard - will be populated by agent mode system
  const [availableAgents, setAvailableAgents] = useState<Array<{
    id: string, 
    name: string, 
    description: string, 
    icon: string, 
    status: string, 
    created_at?: string,
    deployment_status?: string,
    testnet_address?: string,
    deployed_at?: string
  }>>([])

  useEffect(() => {
    checkMicrophonePermission()
    loadJournalEntries()
    loadAgents()
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
        
        // Update live transcript with current results (not accumulating)
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
        // Ensure timestamps in messages are Date objects
        const entriesWithDates = data.entries.map((entry: JournalEntry) => ({
          ...entry,
          messages: entry.messages.map((msg: Message) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))
        setJournalEntries(entriesWithDates)
      }
    } catch (error) {
      console.error('Error loading journal entries:', error)
    }
  }

  const loadAgents = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/agents`)
      if (response.ok) {
        const data = await response.json()
        setAvailableAgents(data.agents)
      }
    } catch (error) {
      console.error('Error loading agents:', error)
    }
  }

  const generateAgent = async (agentId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/agents/${agentId}/generate`, {
        method: 'POST'
      })
      if (response.ok) {
        // Reload agents to update status
        await loadAgents()
        setStatus('Agent generated successfully!')
      } else {
        const error = await response.json()
        setStatus(`Generation failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error generating agent:', error)
      setStatus('Error generating agent')
    }
  }

  const deployAgent = async (agentId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/agents/${agentId}/deploy`, {
        method: 'POST'
      })
      if (response.ok) {
        // Reload agents to update status
        await loadAgents()
        setStatus('Agent deployed successfully!')
      } else {
        const error = await response.json()
        setStatus(`Deployment failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deploying agent:', error)
      setStatus('Error deploying agent')
    }
  }

  const deleteAgent = async (agentId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/agents/${agentId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        // Reload agents to update list
        await loadAgents()
        if (selectedAgent === agentId) {
          setSelectedAgent(null)
        }
        setStatus('Agent deleted successfully!')
      } else {
        const error = await response.json()
        setStatus(`Deletion failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting agent:', error)
      setStatus('Error deleting agent')
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
      // Clear transcript only when starting a completely new session
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

        const aiResponse = await getAIResponse(transcribedText)
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: aiResponse,
          timestamp: new Date()
        }

        // Add messages to the appropriate conversation based on mode
        if (mode === 'journal') {
          setMessages(prev => [...prev, userMessage, aiMessage])
        } else {
          setAgentMessages(prev => [...prev, userMessage, aiMessage])
        }

        await textToSpeech(aiResponse)
      } else {
        setStatus('No speech detected. Try speaking louder or longer.')
      }

      // Clear live transcript after processing the message
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
      // Ensure timestamps are Date objects
      const messagesWithDates = entry.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
      setMessages(messagesWithDates)
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

      if (mode === 'journal') {
        setMessages([])
      } else {
        setAgentMessages([])
      }
      setSelectedEntry(null)
      setStatus('Conversation reset. Ready to start fresh!')

    } catch (error) {
      console.error('Error resetting conversation:', error)
      if (mode === 'journal') {
        setMessages([])
      } else {
        setAgentMessages([])
      }
      setSelectedEntry(null)
      setStatus('Conversation reset locally')
    }
  }

  const startNewConversation = async () => {
    try {
      await fetch(`${apiBaseUrl}/start-new-conversation`, {
        method: 'POST'
      })

      if (mode === 'journal') {
        setMessages([])
      } else {
        setAgentMessages([])
      }
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
              onClick={() => setMode('journal')}
              className={`text-sm font-medium transition-colors hover:text-amber-300 ${
                mode === 'journal' 
                  ? 'text-amber-300' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Journal
            </button>
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-4 p-4">
        {mode === 'agent' ? (
          showAgentDashboard && selectedAgent ? (
            /* Agent Dashboard View */
            <AgentDashboard
              agentId={selectedAgent}
              onBack={() => {
                setShowAgentDashboard(false)
                setSelectedAgent(null)
              }}
              apiBaseUrl={apiBaseUrl}
            />
          ) : (
          /* Agent Mode - Dashboard Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
            {/* Left Side - Voice Button */}
            <div className="lg:col-span-1">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Mic className="w-5 h-5" />
                    Voice Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center space-y-6 h-full min-h-0">
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

                  {/* Chat History Button */}
                  <Button
                    onClick={() => setShowAgentChatHistory(!showAgentChatHistory)}
                    variant="outline"
                    size="sm"
                    className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 bg-white border-gray-300"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Chat History
                  </Button>

                  {selectedAgent && (
                    <div className="text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Active Agent:</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {availableAgents.find(a => a.id === selectedAgent)?.name}
                      </p>
                    </div>
                  )}

                  {/* Agent Chat History Display */}
                  {showAgentChatHistory && (
                    <div className="w-full mt-4">
                      <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-gray-700 dark:text-gray-300">Agent Conversation</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ScrollArea className="h-48">
                            <div className="space-y-3">
                              {agentMessages.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                  No conversation yet
                                </p>
                              ) : (
                                agentMessages.map((message) => (
                                  <div key={message.id} className="space-y-2">
                                    {message.sender === 'user' ? (
                                      /* User Journal Entry - Prominent */
                                      <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-l-3 border-amber-400 rounded-r-md p-2 shadow-sm">
                                        <div className="flex items-center gap-1 mb-1">
                                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                                          <span className="text-xs font-semibold text-amber-800">Entry</span>
                                          <span className="text-xs text-amber-600">
                                            {message.timestamp.toLocaleTimeString()}
                                          </span>
                                        </div>
                                        <div className="text-gray-800 text-xs leading-relaxed font-medium">
                                          {message.text}
                                        </div>
                                      </div>
                                    ) : (
                                      /* AI Response - Subtle annotation */
                                      <div className="ml-4 bg-gray-50 dark:bg-gray-800 border-l-2 border-gray-300 dark:border-gray-600 rounded-r-sm p-2">
                                        <div className="flex items-center gap-1 mb-1">
                                          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Agent</span>
                                        </div>
                                        <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed italic">
                                          {message.text}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Agent List */}
            <div className="lg:col-span-2">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-gray-900 dark:text-white">
                        Available Agents ({availableAgents.length})
                        {selectedAgent && (
                          <span className="ml-2 text-sm font-normal text-amber-600">
                            • 1 selected
                          </span>
                        )}
                      </CardTitle>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        AI agents created from your problem descriptions. Click to select/unselect agents, then deploy them to start using their specialized capabilities.
                      </p>
                    </div>
                    <Button
                      onClick={loadAgents}
                      variant="outline"
                      size="sm"
                      className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 bg-white border-gray-300"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                   <div className="h-[calc(100vh-12rem)] overflow-hidden">
                    {availableAgents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Bot className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No agents available
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                          Create agents by describing problems in Journal mode. The system will automatically generate specialized agents for you.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-full">
                        <div className="space-y-2 pr-4">
                          {availableAgents.map((agent) => {
                          // Determine status and color based on agent data
                          const getStatusInfo = (agent: any) => {
                            if (agent.deployment_status === 'success' || agent.status === 'deployed') {
                              return { status: 'Active', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50' }
                            } else if (agent.status === 'generated' || agent.deployment_status === 'pending') {
                              return { status: 'Pending', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50' }
                            } else if (agent.status === 'yaml_only') {
                              return { status: 'YAML Ready', color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50' }
                            } else if (agent.status === 'error' || agent.deployment_status === 'failed') {
                              return { status: 'Error', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' }
                            } else {
                              return { status: 'Unknown', color: 'bg-gray-400', textColor: 'text-gray-700', bgColor: 'bg-gray-50' }
                            }
                          }
                          
                          const statusInfo = getStatusInfo(agent)
                          
                          return (
                            <div
                              key={agent.id}
                              className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                                selectedAgent === agent.id
                                  ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300 shadow-md ring-2 ring-amber-200'
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-sm hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => {
                                setSelectedAgent(agent.id)
                                setShowAgentDashboard(true)
                              }}
                            >
                              <div className="relative">
                                <Bot className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                                {selectedAgent === agent.id && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                                    {agent.name}
                                  </h3>
                                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                                    {statusInfo.status}
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
                                  {agent.description}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                  {agent.created_at && (
                                    <span>Created: {new Date(agent.created_at).toLocaleDateString()}</span>
                                  )}
                                  {agent.testnet_address && (
                                    <span className="font-mono text-xs">Address: {agent.testnet_address}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${statusInfo.color} animate-pulse`}></div>
                                <div className="flex gap-2">
                                  {agent.status === 'yaml_only' && (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        generateAgent(agent.id)
                                      }}
                                      size="sm"
                                      variant="outline"
                                      className="text-xs px-3 py-1 bg-white hover:bg-gray-50 text-green-700 border-green-300"
                                    >
                                      Generate
                                    </Button>
                                  )}
                                  {agent.status === 'generated' && (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deployAgent(agent.id)
                                      }}
                                      size="sm"
                                      variant="outline"
                                      className="text-xs px-3 py-1 bg-white hover:bg-gray-50 text-blue-700 border-blue-300"
                                    >
                                      Deploy
                                    </Button>
                                  )}
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteAgent(agent.id)
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="text-xs px-3 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 bg-white border-red-300"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          )
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
                  className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                >
                  {isSaving ? 'Saving...' : 'Save Journal'}
                </Button>
                <Button
                  onClick={startNewConversation}
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  className="text-gray-700 hover:text-gray-800 hover:bg-gray-50 bg-white border-gray-300"
                >
                  New Chat
                </Button>
                <Button
                  onClick={resetConversation}
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
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
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
                  <h3 className="text-sm font-medium text-white">
                    {selectedEntry ? (
                      <div className="flex items-center gap-2">
                        <span>Journal Entry</span>
                        <span className="text-xs text-gray-400">
                          {journalEntries.find(e => e.id === selectedEntry)?.timestamp && 
                            new Date(journalEntries.find(e => e.id === selectedEntry)!.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      'Current Journal'
                    )}
                  </h3>
                  {selectedEntry && journalEntries.find(e => e.id === selectedEntry)?.summary && (
                    <Button
                      onClick={() => showConversationSummary(selectedEntry)}
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 bg-white border-blue-300"
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
                      <div key={message.id} className="space-y-3">
                        {message.sender === 'user' ? (
                          /* User Journal Entry - Prominent */
                          <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-l-4 border-amber-400 rounded-r-lg p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                              <span className="text-sm font-semibold text-amber-800">Journal Entry</span>
                              <span className="text-xs text-amber-600">
                                {message.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-gray-800 text-base leading-relaxed font-medium">
                              {message.text}
                            </div>
                          </div>
                        ) : (
                          /* AI Response - Subtle annotation */
                          <div className="ml-6 bg-gray-50 dark:bg-gray-800 border-l-2 border-gray-300 dark:border-gray-600 rounded-r-md p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">AI Reflection</span>
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                              {message.text}
                            </div>
                          </div>
                        )}
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
                className="text-gray-500 hover:text-gray-700 bg-white"
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
                className="text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 border-gray-300"
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