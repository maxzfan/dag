import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { ArrowLeft, RefreshCw, Save, Plus, Trash2, Terminal, Settings } from 'lucide-react'

interface AgentDashboardProps {
  agentId: string
  onBack: () => void
  apiBaseUrl: string
}

interface AgentDetails {
  id: string
  name: string
  description: string
  icon: string
  status: string
  created_at?: string
  deployment_status?: string
  testnet_address?: string
  deployed_at?: string
  agent_directory?: string
}

interface EnvVar {
  key: string
  value: string
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ agentId, onBack, apiBaseUrl }) => {
  const [agent, setAgent] = useState<AgentDetails | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'logs' | 'env'>('logs')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadAgentDetails = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/agents/${agentId}`)
      if (response.ok) {
        const data = await response.json()
        setAgent(data.agent)
        
        // Convert env_vars object to array
        const envArray = Object.entries(data.env_vars || {}).map(([key, value]) => ({
          key,
          value: value as string
        }))
        setEnvVars(envArray)
      }
    } catch (error) {
      console.error('Error loading agent details:', error)
    }
  }

  const loadLogs = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/agents/${agentId}/logs`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    }
  }

  const saveEnvVars = async () => {
    setSaving(true)
    try {
      // Convert array back to object
      const envObject = envVars.reduce((acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value
        }
        return acc
      }, {} as Record<string, string>)

      const response = await fetch(`${apiBaseUrl}/agents/${agentId}/env`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ env_vars: envObject })
      })

      if (response.ok) {
        alert('Environment variables saved successfully!')
      } else {
        alert('Failed to save environment variables')
      }
    } catch (error) {
      console.error('Error saving env vars:', error)
      alert('Error saving environment variables')
    } finally {
      setSaving(false)
    }
  }

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars]
    updated[index][field] = value
    setEnvVars(updated)
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await loadAgentDetails()
      await loadLogs()
      setLoading(false)
    }
    loadData()
  }, [agentId])

  // Auto-refresh logs every 5 seconds
  useEffect(() => {
    if (autoRefresh && activeTab === 'logs') {
      const interval = setInterval(() => {
        loadLogs()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, activeTab, agentId])

  const getStatusColor = (status: string) => {
    if (status === 'deployed') return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
    if (status === 'generated') return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
    if (status === 'yaml_only') return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
    if (status === 'error') return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400 dark:text-gray-500" />
          <p className="text-gray-500 dark:text-gray-400">Loading agent details...</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Agent not found</p>
          <Button onClick={onBack} className="mt-4 bg-white hover:bg-gray-50 text-gray-700 border-gray-300">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={onBack}
              variant="outline"
              size="sm"
              className="text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-50 border-gray-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {agent.name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {agent.description}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(agent.status)}`}>
              {agent.status}
            </span>
          </div>
        </div>

        {/* Agent Info */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          {agent.testnet_address && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Address:</span>
              <span className="ml-2 font-mono text-gray-900 dark:text-white">
                {agent.testnet_address}
              </span>
            </div>
          )}
          {agent.created_at && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Created:</span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {new Date(agent.created_at).toLocaleString()}
              </span>
            </div>
          )}
          {agent.deployed_at && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Deployed:</span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {new Date(agent.deployed_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 p-2">
          <Button
            onClick={() => setActiveTab('logs')}
            variant={activeTab === 'logs' ? 'default' : 'ghost'}
            size="sm"
            className="gap-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
          >
            <Terminal className="w-4 h-4" />
            Logs
          </Button>
          <Button
            onClick={() => setActiveTab('env')}
            variant={activeTab === 'env' ? 'default' : 'ghost'}
            size="sm"
            className="gap-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
          >
            <Settings className="w-4 h-4" />
            Environment Variables
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'logs' && (
          <Card className="h-full rounded-none border-0 bg-white dark:bg-gray-800">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-900 dark:text-white">Agent Logs</CardTitle>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded"
                    />
                    Auto-refresh
                  </label>
                  <Button
                    onClick={loadLogs}
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-5rem)] bg-white dark:bg-gray-800">
              <ScrollArea className="h-full">
                <div className="p-4 font-mono text-sm space-y-1 bg-white dark:bg-gray-800">
                  {logs.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No logs available
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div
                        key={index}
                        className="text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded"
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {activeTab === 'env' && (
          <Card className="h-full rounded-none border-0 bg-white dark:bg-gray-800">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-900 dark:text-white">Environment Variables</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={addEnvVar}
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                  >
                    <Plus className="w-4 h-4" />
                    Add Variable
                  </Button>
                  <Button
                    onClick={saveEnvVars}
                    disabled={saving}
                    size="sm"
                    className="gap-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 h-[calc(100%-5rem)] bg-white dark:bg-gray-800">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {envVars.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No environment variables configured
                      <br />
                      <Button onClick={addEnvVar} variant="outline" size="sm" className="mt-4 bg-white hover:bg-gray-50 text-gray-700 border-gray-300">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Variable
                      </Button>
                    </div>
                  ) : (
                    envVars.map((envVar, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="KEY"
                          value={envVar.key}
                          onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                          className="flex-1 font-mono dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <span className="text-gray-400 dark:text-gray-500">=</span>
                        <Input
                          placeholder="value"
                          value={envVar.value}
                          onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                          className="flex-1 font-mono dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          type="text"
                        />
                        <Button
                          onClick={() => removeEnvVar(index)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 bg-white border-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
